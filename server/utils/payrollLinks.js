// server/utils/payrollLinks.js
//
// Answers "does each login see the right person's payroll?".
//
// A login sees the payslips of the employee record it is linked to
// (User.employee), and a payslip belongs to the employee on the PayrollEntry.
// Two things can therefore go wrong: the login is linked to the wrong employee
// record, or payroll rows were attached to the wrong employee when the sheets
// were imported (easy to do when two staff share a name, like the two
// "John Mwangi"s). This module checks both, using two independent signals:
//
//   1. the NAME written on the payroll sheet (PayrollEntry.payrollName) against
//      the employee's name, other names and remembered payroll aliases;
//   2. the BANK ACCOUNT paid on the payroll row against the bank account on the
//      employee record (which HR keeps correct). If a row pays an account that
//      belongs to a different employee, that row is almost certainly misfiled.
const Employee = require('../models/Employee');
const User = require('../models/User');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollRun = require('../models/PayrollRun');
const { MATCH, CANONICAL } = require('./payrollAliases');

const nameKey = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/-\s*TEMP.*$/, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
const fullName = (e) => `${e.firstName} ${e.lastName}`.trim();
const last4 = (acc) => (digits(acc).length ? `…${digits(acc).slice(-4)}` : '');
const MIN_ACC = 6; // ignore very short "account numbers"

// Normalised account -> [employee ids that own it]
async function loadAccountOwners() {
  const emps = await Employee.find({ bankAccount: { $exists: true, $ne: '' } }).select('bankAccount').lean();
  const map = new Map();
  for (const e of emps) {
    const d = digits(e.bankAccount);
    if (d.length < MIN_ACC) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(String(e._id));
  }
  return map;
}

// If this payroll row pays an account that belongs to SOMEONE ELSE (and not to
// the employee it is filed under), return the owners; otherwise null.
function foreignAccountOwners(entry, employeeId, owners) {
  const d = digits(entry.computed && entry.computed.acc_no);
  if (d.length < MIN_ACC) return null;
  const list = owners.get(d);
  if (!list || !list.length || list.includes(String(employeeId))) return null;
  return list;
}

// Every payroll-sheet spelling that legitimately refers to this employee.
function acceptableKeys(e) {
  const first = nameKey(e.firstName);
  const last = nameKey(e.lastName);
  const keys = new Set([`${first} ${last}`.trim(), ...(e.payrollAliases || []).map(nameKey)]);
  const others = ((e.notes || '').match(/Other names:\s*([^|]+)/i) || [])[1];
  if (others) {
    const o = nameKey(others);
    [`${first} ${o}`, `${first} ${o} ${last}`, `${first} ${last} ${o}`, o].forEach((k) => keys.add(k.trim()));
  }
  for (const [k, m] of Object.entries(MATCH)) {
    if (m.fullName) { if (nameKey(m.fullName) === `${first} ${last}`.trim()) keys.add(k); continue; }
    if (nameKey(m.firstName) === first && nameKey(m.lastName) === last && (!m.department || m.department === e.department)) keys.add(k);
  }
  for (const [k, canon] of Object.entries(CANONICAL)) if (canon === `${first} ${last}`.trim()) keys.add(k);
  // sheet spellings made only of this person's own name parts, e.g. "JOHN GAKUNDI"
  // for "John Gakundi Mwangi" (two or more parts, so a lone first name never counts)
  keys.tokens = new Set([...first.split(' '), ...last.split(' '), ...(others ? nameKey(others).split(' ') : [])].filter(Boolean));
  return keys;
}
const isAcceptable = (keys, key) => keys.has(key) || (key.split(' ').filter(Boolean).length >= 2 && key.split(' ').every((t) => keys.tokens.has(t)));

async function auditPayrollLinks() {
  const [users, employees, entries, runs, owners] = await Promise.all([
    User.find().select('name email role isActive employee').lean(),
    Employee.find().select('firstName lastName email employeeId department role bankName bankAccount notes payrollAliases').lean(),
    PayrollEntry.find().select('employee period runType payrollName section computed.acc_no').lean(),
    PayrollRun.find().select('period runType status').lean(),
    loadAccountOwners(),
  ]);

  const empById = new Map(employees.map((e) => [String(e._id), e]));
  const runStatus = Object.fromEntries(runs.map((r) => [`${r.period}|${r.runType}`, r.status]));
  const entriesByEmp = new Map();
  for (const en of entries) {
    const k = String(en.employee);
    if (!entriesByEmp.has(k)) entriesByEmp.set(k, []);
    entriesByEmp.get(k).push(en);
  }
  const sameNameCount = new Map();
  for (const e of employees) {
    const k = nameKey(fullName(e));
    sameNameCount.set(k, (sameNameCount.get(k) || 0) + 1);
  }
  const usersByEmp = new Map();
  for (const u of users) {
    if (!u.employee) continue;
    const k = String(u.employee);
    if (!usersByEmp.has(k)) usersByEmp.set(k, []);
    usersByEmp.get(k).push(u);
  }
  const brief = (e) => ({ id: String(e._id), name: fullName(e), employeeId: e.employeeId, department: e.department });

  const rows = users.map((u) => {
    const base = { userId: String(u._id), name: u.name, email: u.email, role: u.role, isActive: u.isActive };
    const e = u.employee ? empById.get(String(u.employee)) : null;
    if (!u.employee) return { ...base, employee: null, status: 'unlinked', issues: [], payslips: { count: 0, latest: null, withheld: 0 }, payrollNames: [] };
    if (!e) {
      return { ...base, employee: null, status: 'wrong', payslips: { count: 0, latest: null, withheld: 0 }, payrollNames: [], issues: [{ level: 'wrong', code: 'dangling', message: 'This login points at an employee record that no longer exists.' }] };
    }

    const issues = [];
    const mine = entriesByEmp.get(String(e._id)) || [];
    const accepted = acceptableKeys(e);

    // 0. is this login really for this person? The seeded logins use the same
    //    email as the employee record, so a different email means a wrong link.
    if (String(u.email).toLowerCase() !== String(e.email || '').toLowerCase()) {
      const rightful = employees.find((x) => String(x.email || '').toLowerCase() === String(u.email).toLowerCase());
      issues.push(
        rightful
          ? { level: 'wrong', code: 'wrong-employee', message: `This login (${u.email}) is linked to ${fullName(e)} (${e.department}), but its email belongs to the employee record ${fullName(rightful)} (${rightful.department}). It is probably seeing someone else's data.`, suggestEmployee: brief(rightful) }
          : { level: 'review', code: 'email-mismatch', message: `The login email (${u.email}) differs from the linked employee's email (${e.email}). Confirm this login really is ${fullName(e)}.` }
      );
    }

    // 1. who else uses the same employee record?
    const sharing = (usersByEmp.get(String(e._id)) || []).filter((x) => String(x._id) !== String(u._id));
    if (sharing.length) {
      issues.push({ level: 'wrong', code: 'shared-link', message: `Also linked to the login ${sharing.map((x) => x.email).join(', ')}. Two logins on one employee record see the same payslips.` });
    }

    // 2. payroll-sheet names vs this employee
    const names = new Map();
    for (const en of mine) {
      const n = en.payrollName || '';
      if (!names.has(n)) names.set(n, { name: n, count: 0, periods: [] });
      const g = names.get(n);
      g.count++;
      g.periods.push(en.period);
    }
    for (const g of names.values()) {
      if (g.name && !isAcceptable(accepted, nameKey(g.name))) {
        issues.push({ level: 'wrong', code: 'name-mismatch', payrollName: g.name, message: `${g.count} payroll row(s) (${[...new Set(g.periods)].sort().join(', ')}) are filed under this employee but were written as "${g.name}" on the sheet.` });
      }
    }

    // 3. bank account on each row vs who owns that account
    let corroborated = 0;
    const foreign = new Map();
    for (const en of mine) {
      const d = digits(en.computed && en.computed.acc_no);
      if (d.length < MIN_ACC) continue;
      const list = owners.get(d);
      if (!list) continue;
      if (list.includes(String(e._id))) corroborated++;
      else {
        const k = list.join(',');
        if (!foreign.has(k)) foreign.set(k, { owners: list, periods: [], names: new Set() });
        foreign.get(k).periods.push(en.period);
        foreign.get(k).names.add(en.payrollName || '');
      }
    }
    let withheld = 0;
    for (const f of foreign.values()) {
      const owner = empById.get(f.owners[0]);
      withheld += f.periods.length;
      issues.push({
        level: 'wrong',
        code: 'foreign-account',
        message: `${f.periods.length} payroll row(s) (${[...new Set(f.periods)].sort().join(', ')}) pay a bank account that belongs to ${owner ? `${fullName(owner)} (${owner.department})` : 'another employee'}, not to ${fullName(e)}. They are hidden from this login until fixed.`,
        suggestEmployee: owner ? brief(owner) : null,
        payrollNames: [...f.names],
      });
    }

    // 4. same-name colleague and nothing to tell them apart
    if (sameNameCount.get(nameKey(fullName(e))) > 1 && corroborated === 0 && mine.length) {
      issues.push({ level: 'review', code: 'same-name', message: `Another employee has exactly the same name. Nothing on the payroll rows (bank account) confirms these payslips belong to this ${fullName(e)} - check the details below.` });
    }
    if (!mine.length) issues.push({ level: 'info', code: 'no-payroll', message: 'No payroll rows are filed under this employee, so their payslips page will be empty.' });
    if (!e.bankAccount && mine.length) issues.push({ level: 'review', code: 'no-bank', message: 'This employee has no bank account on file, so payroll rows cannot be cross-checked by account.' });

    const visible = mine.filter((en) => runStatus[`${en.period}|${en.runType}`] && runStatus[`${en.period}|${en.runType}`] !== 'Draft');
    const shown = visible.filter((en) => !foreignAccountOwners(en, e._id, owners));
    const latest = shown.map((x) => x.period).sort().pop() || null;
    const level = issues.some((i) => i.level === 'wrong') ? 'wrong' : issues.some((i) => i.level === 'review') ? 'review' : mine.length ? 'ok' : 'no_payroll';
    return {
      ...base,
      employee: { ...brief(e), jobTitle: e.role, bank: e.bankName ? `${e.bankName} ${last4(e.bankAccount)}`.trim() : last4(e.bankAccount) },
      status: level,
      issues,
      payslips: { count: shown.length, latest, withheld: visible.length - shown.length },
      payrollNames: [...names.values()].map((g) => ({ name: g.name, count: g.count })),
    };
  });

  const order = { wrong: 0, review: 1, unlinked: 2, no_payroll: 3, ok: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  const summary = rows.reduce((s, r) => ({ ...s, [r.status]: (s[r.status] || 0) + 1 }), {});
  return { summary, rows };
}

// Move payroll rows (by the name written on the sheet) from one employee to
// another - the fix for rows imported onto the wrong person. Rows that would
// collide with an existing row for the same month are skipped and reported.
async function moveEntries({ from, to, payrollNames }) {
  const [src, dst] = await Promise.all([Employee.findById(from), Employee.findById(to)]);
  if (!src || !dst) throw Object.assign(new Error('Employee not found'), { status: 404 });
  if (String(src._id) === String(dst._id)) throw Object.assign(new Error('Choose a different employee to move the payroll to'), { status: 400 });
  if (!Array.isArray(payrollNames) || !payrollNames.length) throw Object.assign(new Error('Choose which payroll rows to move'), { status: 400 });

  const entries = await PayrollEntry.find({ employee: src._id, payrollName: { $in: payrollNames } });
  const moved = [];
  const skipped = [];
  for (const en of entries) {
    const clash = await PayrollEntry.exists({ employee: dst._id, period: en.period, runType: en.runType });
    if (clash) { skipped.push(`${en.period} ${en.runType} (${fullName(dst)} already has a row)`); continue; }
    en.employee = dst._id;
    await en.save();
    moved.push(`${en.period} ${en.runType}`);
  }
  const keys = [...new Set(payrollNames.map(nameKey).filter(Boolean))];
  if (moved.length && keys.length) {
    await Employee.updateOne({ _id: src._id }, { $pull: { payrollAliases: { $in: keys } } });
    await Employee.updateOne({ _id: dst._id }, { $addToSet: { payrollAliases: { $each: keys } } });
  }
  return { from: fullName(src), to: fullName(dst), moved, skipped };
}

module.exports = { auditPayrollLinks, moveEntries, loadAccountOwners, foreignAccountOwners, nameKey, digits };
