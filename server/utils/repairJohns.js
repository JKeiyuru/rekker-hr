// server/utils/repairJohns.js
//
// One-off repair for the two staff who share a name:
//   John Kariuki Mwangi  - Merchandiser   (called "JOHN MWANGI" / "JOHN KARIUKI MWANGI" on the payroll sheets)
//   John Gakundi Mwangi  - Accountant     (called "JOHN GAKUNDI")
//
// What it does
//   1. removes every payroll row written under either name (and any row filed
//      under either employee record), for January-September;
//   2. removes the login accounts for both of them (plus any stray "John Mwangi"
//      login), so you can create them again linked to the right record;
//   3. re-imports their January-September rows from the payroll workbook onto
//      the correct employee record, by name AND checked against their bank
//      account, using each month's frozen template so the figures are exactly
//      what was paid. Locked (Approved/Paid) runs stay locked.
//
// It is a DRY RUN unless you add --apply, so you can read the plan first.
//
//   npm run repair:johns                      dry run - shows what it would do
//   npm run repair:johns -- --apply           do it
//   npm run repair:johns -- --apply --recreate-logins
//        ...and create the two logins again (role "employee", the original seed
//        passwords) linked to the right employee records
//   --include-other   also delete their payroll rows OUTSIDE Jan-Sep End-Month
//                     (mid-month runs, October...). By default those are kept.
//   --file=path.xlsx  use another workbook (default data/PAYROLL_2026_1.xlsx)
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Employee = require('../models/Employee');
const User = require('../models/User');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollRun = require('../models/PayrollRun');
const imp = require('../services/payrollImport');
const svc = require('../services/payrollService');
const { auditPayrollLinks, loadAccountOwners, foreignAccountOwners, digits } = require('./payrollLinks');

const nameKey = imp.nameKey;
const fullKey = (e) => nameKey(`${e.firstName} ${e.lastName}`);

// How each spelling on the payroll sheets maps to a person.
const SIDE = {
  'JOHN MWANGI': 'merch',
  'JOHN KARIUKI MWANGI': 'merch',
  'JOHN KARIUKI': 'merch',
  'JOHN GAKUNDI': 'acct',
  'JOHN GAKUNDI MWANGI': 'acct',
};
const PEOPLE = {
  merch: { label: 'John Kariuki Mwangi (Merchandiser)', fullName: 'JOHN KARIUKI MWANGI', nationalId: '754870133', dept: 'MERCHANDISING', aliases: ['JOHN MWANGI', 'JOHN KARIUKI MWANGI'], login: { email: 'johnk@rekker.co.ke', password: 'John@885' } },
  acct: { label: 'John Gakundi Mwangi (Accountant)', fullName: 'JOHN GAKUNDI MWANGI', nationalId: '32371503', dept: 'ACCOUNTS', aliases: ['JOHN GAKUNDI'], login: { email: 'john@rekker.co.ke', password: 'John@653' } },
};
const SEED_EMAILS = ['john@rekker.co.ke', 'johnk@rekker.co.ke'];

function findPerson(all, side) {
  const p = PEOPLE[side];
  let hits = all.filter((e) => fullKey(e) === p.fullName);
  if (hits.length !== 1) hits = all.filter((e) => e.nationalId && e.nationalId === p.nationalId);
  if (hits.length !== 1) hits = all.filter((e) => nameKey(e.firstName) === 'JOHN' && nameKey(e.department) === p.dept && fullKey(e).includes(side === 'acct' ? 'GAKUNDI' : 'KARIUKI'));
  return hits;
}

// Reads the database and works out exactly what would change. Writes nothing.
async function plan({ includeOther = false } = {}) {
  const all = await Employee.find({}).select('firstName lastName email department role nationalId bankName bankAccount payrollAliases').lean();
  const people = {};
  for (const side of ['merch', 'acct']) {
    const hits = findPerson(all, side);
    if (hits.length !== 1) {
      const cands = all.filter((e) => nameKey(e.firstName) === 'JOHN').map((e) => `${e.firstName} ${e.lastName} (${e.department}, ${e.email})`);
      throw new Error(`Could not find exactly one employee record for ${PEOPLE[side].label} (found ${hits.length}). Employees called John: ${cands.join('; ') || 'none'}`);
    }
    people[side] = hits[0];
  }
  if (String(people.merch._id) === String(people.acct._id)) throw new Error('Both Johns resolved to the same employee record - stopping.');
  const ids = new Set([String(people.merch._id), String(people.acct._id)]);
  const strays = all.filter((e) => !ids.has(String(e._id)) && (SIDE[fullKey(e)] || ['JOHN MWANGI', 'JOHN GAKUNDI'].includes(fullKey(e))));

  const entries = await PayrollEntry.find({}).select('employee period runType payrollName section order computed.acc_no').lean();
  const mine = entries.filter((e) => ids.has(String(e.employee)) || strays.some((s) => String(s._id) === String(e.employee)) || SIDE[nameKey(e.payrollName)]);
  const inScope = (e) => e.runType === 'End-Month' && /^2026-0[1-9]$/.test(e.period);
  const del = mine.filter((e) => includeOther || inScope(e));
  const kept = mine.filter((e) => !(includeOther || inScope(e)));
  const slot = {}; // period|side -> { order, section } so the rows go back in the same place on the sheet
  for (const e of del) {
    const side = SIDE[nameKey(e.payrollName)] || (String(e.employee) === String(people.merch._id) ? 'merch' : String(e.employee) === String(people.acct._id) ? 'acct' : null);
    if (side && inScope(e)) slot[`${e.period}|${side}`] = { order: e.order, section: e.section };
  }

  const users = await User.find({}).select('name email role isSuperAdmin employee').lean();
  const strayIds = new Set(strays.map((s) => String(s._id)));
  const isJohnUser = (u) => (u.employee && (ids.has(String(u.employee)) || strayIds.has(String(u.employee)))) || SEED_EMAILS.includes(String(u.email).toLowerCase()) || SIDE[nameKey(u.name)];
  const matched = users.filter(isJohnUser);
  const protectedUsers = matched.filter((u) => u.isSuperAdmin || u.role === 'admin');
  const usersToDelete = matched.filter((u) => !protectedUsers.includes(u));

  return { people, strays, del, kept, slot, usersToDelete, protectedUsers, allEmployees: all };
}

function describe(pl) {
  const lines = [];
  lines.push(`Merchandiser record : ${pl.people.merch.firstName} ${pl.people.merch.lastName} (${pl.people.merch.department}) <${pl.people.merch.email}> bank …${digits(pl.people.merch.bankAccount).slice(-4)}`);
  lines.push(`Accountant record   : ${pl.people.acct.firstName} ${pl.people.acct.lastName} (${pl.people.acct.department}) <${pl.people.acct.email}> bank …${digits(pl.people.acct.bankAccount).slice(-4)}`);
  if (pl.strays.length) lines.push(`Stray look-alike employee records (NOT touched, check them yourself): ${pl.strays.map((s) => `${s.firstName} ${s.lastName} <${s.email}>`).join('; ')}`);
  lines.push(`Payroll rows to delete : ${pl.del.length}`);
  lines.push(`Payroll rows kept      : ${pl.kept.length}${pl.kept.length ? ` (${pl.kept.map((e) => `${e.period} ${e.runType}`).join(', ')}) - add --include-other to delete these too` : ''}`);
  lines.push(`Logins to delete       : ${pl.usersToDelete.length ? pl.usersToDelete.map((u) => `${u.name} <${u.email}>`).join('; ') : 'none found'}`);
  if (pl.protectedUsers.length) lines.push(`Logins NOT deleted (admin accounts): ${pl.protectedUsers.map((u) => u.email).join(', ')}`);
  return lines.join('\n');
}

// Picks the two Johns' rows out of the workbook and works out which person each is.
async function readJohnRows(wb) {
  const out = [];
  for (const ws of wb.worksheets) {
    const period = imp.guessPeriod(ws);
    if (!period || !/^2026-0[1-9]$/.test(period)) continue;
    const run = await PayrollRun.findOne({ period, runType: 'End-Month' });
    const template = await svc.getTemplate('End-Month');
    const columns = svc.columnsForRun(run, template);
    const preview = await imp.previewSheet(ws, { columns }, 'End-Month');
    if (!preview.ok) { out.push({ sheet: ws.name, period, error: preview.reason }); continue; }
    const accIdx = (preview.columns.find((c) => c.target === 'acc_no') || {}).index;
    const rows = preview.rows
      .filter((r) => SIDE[nameKey(r.name)])
      .map((r) => ({ name: r.name, side: SIDE[nameKey(r.name)], section: r.section, cells: r.cells, acc: accIdx ? String(r.cells[accIdx] || '') : '' }));
    out.push({ sheet: ws.name, period, hasRun: !!run, mapping: preview.columns, rows });
  }
  return out;
}

async function apply(pl, sheets, { recreateLogins = false, file = '' } = {}) {
  const log = [];
  const systemUser = { _id: null, name: 'Repair script (Johns)', role: 'admin' };

  // 1. payroll rows
  const del = await PayrollEntry.deleteMany({ _id: { $in: pl.del.map((e) => e._id) } });
  log.push(`Deleted ${del.deletedCount} payroll rows`);

  // 2. logins
  if (pl.usersToDelete.length) {
    const r = await User.deleteMany({ _id: { $in: pl.usersToDelete.map((u) => u._id) }, isSuperAdmin: { $ne: true } });
    log.push(`Deleted ${r.deletedCount} logins`);
  }

  // 3. payroll names remembered on employee records: clear them everywhere, then set them properly
  const keys = Object.keys(SIDE);
  await Employee.updateMany({}, { $pull: { payrollAliases: { $in: keys } } });
  for (const side of ['merch', 'acct']) await Employee.updateOne({ _id: pl.people[side]._id }, { $addToSet: { payrollAliases: { $each: PEOPLE[side].aliases } } });
  log.push('Reset remembered payroll names on both records');

  // 4. re-import
  for (const s of sheets) {
    if (s.error || !s.hasRun) { log.push(`${s.sheet}: skipped (${s.error || 'no pay run exists for this month - run seed:payroll first'})`); continue; }
    const rows = s.rows.map((r) => ({
      name: r.name, section: r.section, cells: r.cells,
      employee: String(pl.people[r.side]._id),
      order: pl.slot[`${s.period}|${r.side}`] ? pl.slot[`${s.period}|${r.side}`].order : undefined,
    }));
    const res = await imp.commitSheet({ period: s.period, runType: 'End-Month', mapping: s.mapping, rows, replace: false, source: file, allowLocked: true }, systemUser);
    log.push(`${s.sheet}: imported ${res.imported} row(s)${res.warnings.length ? `; warnings: ${res.warnings.join(' | ')}` : ''}`);
  }

  // 5. logins again, linked correctly (optional)
  if (recreateLogins) {
    for (const side of ['merch', 'acct']) {
      const emp = pl.people[side];
      const { email, password } = PEOPLE[side].login;
      if (await User.findOne({ email })) { log.push(`Login ${email} already exists - left alone`); continue; }
      if (await User.findOne({ employee: emp._id })) { log.push(`${PEOPLE[side].label} already has a login - left alone`); continue; }
      await User.create({ name: `${emp.firstName} ${emp.lastName}`, email, password, role: 'employee', employee: emp._id });
      log.push(`Created login ${email} -> ${emp.firstName} ${emp.lastName} (${emp.department})`);
    }
  }
  try { await svc.audit(systemUser, 'repair.johns', { summary: log.join('; ').slice(0, 900) }); } catch (e) { /* audit is best-effort */ }
  return log;
}

// What the database holds for each John now, with a bank-account check.
async function verify(pl) {
  const owners = await loadAccountOwners();
  const lines = [];
  for (const side of ['merch', 'acct']) {
    const emp = pl.people[side];
    const rows = await PayrollEntry.find({ employee: emp._id }).sort({ period: 1, runType: 1 }).lean();
    lines.push(`\n${PEOPLE[side].label}  -  ${rows.length} payroll row(s)`);
    for (const r of rows) {
      const acc = r.computed && r.computed.acc_no;
      const foreign = foreignAccountOwners(r, emp._id, owners);
      lines.push(`  ${r.period} ${r.runType.padEnd(9)} "${r.payrollName}"  gross ${r.gross}  net ${r.net}  acct …${digits(acc).slice(-4)}${foreign ? '   !! pays an account that belongs to ANOTHER employee' : ''}`);
    }
  }
  const audit = await auditPayrollLinks();
  const bad = audit.rows.filter((r) => r.status === 'wrong' && r.employee && [pl.people.merch, pl.people.acct].some((p) => String(p._id) === r.employee.id));
  lines.push(bad.length ? `\nAudit: ${bad.length} login(s) still flagged - open Payroll Links.` : '\nAudit: no flagged logins for either John.');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const file = (args.find((a) => a.startsWith('--file=')) || '').slice(7) || path.join(__dirname, '..', 'data', 'PAYROLL_2026_1.xlsx');
  const mongoose = require('mongoose');
  await require('../config/db')();
  await svc.getTemplate('End-Month');

  const pl = await plan({ includeOther: args.includes('--include-other') });
  console.log(`\n${doApply ? 'APPLYING' : 'DRY RUN (nothing will be changed)'}\n${'-'.repeat(60)}\n${describe(pl)}`);

  const wb = await imp.loadWorkbook(file);
  const sheets = await readJohnRows(wb);
  console.log(`\nRows found in ${path.basename(file)}:`);
  for (const s of sheets) {
    console.log(`  ${s.sheet.padEnd(16)} ${s.error ? 'ERROR ' + s.error : s.rows.map((r) => `${r.name} -> ${r.side === 'acct' ? 'Accountant' : 'Merchandiser'} (acct …${digits(r.acc).slice(-4)})`).join('   |   ')}${s.hasRun === false ? '   (no pay run for this month!)' : ''}`);
    if (!s.error && s.rows.length !== 2) console.log(`    !! expected 2 rows, found ${s.rows.length}`);
  }

  if (!doApply) {
    console.log('\nNothing changed. Re-run with --apply to do it (add --recreate-logins to create the two logins again).');
  } else {
    const log = await apply(pl, sheets, { recreateLogins: args.includes('--recreate-logins'), file: path.basename(file) });
    console.log(`\n${log.map((l) => '  ' + l).join('\n')}`);
    console.log(await verify(pl));
  }
  await mongoose.connection.close();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('\nStopped:', e.message); process.exit(1); });
}

module.exports = { plan, describe, readJohnRows, apply, verify, SIDE, PEOPLE };
