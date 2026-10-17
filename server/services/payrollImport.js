// server/services/payrollImport.js
//
// Reads an Excel payroll workbook (any layout the accountant uses) and maps it
// onto the payroll template.
//
//   previewSheet()  - detect header row, suggest column mapping, match staff
//   commitSheet()   - write the rows into a pay run
//   importWorkbookAuto() - every month-sheet in a workbook in one go
//
// Mapping is by header TEXT (never by fixed column letter), so a sheet with
// extra or re-ordered columns still imports. If the accountant's Excel has a
// column the template doesn't, they "prime" the template first (add the
// column) - or create it from the mapping screen - then map to it.
const ExcelJS = require('exceljs');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');
const PayrollEntry = require('../models/PayrollEntry');
const svc = require('./payrollService');
const { MATCH, CANONICAL, NEW_EMPLOYEE_DEFAULTS } = require('../utils/payrollAliases');
const { references } = require('../utils/formula');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nameKey = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/-\s*TEMP.*$/, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// ---- workbook reading ---------------------------------------------------------
function cellVal(cell) {
  if (!cell) return null;
  let v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result;
    else if (v.richText) v = v.richText.map((r) => r.text).join('');
    else if (v.text) v = v.text;
    else if (v.error) return null;
  }
  if (v && typeof v === 'object' && !(v instanceof Date)) return null;
  if (typeof v === 'string') v = v.trim();
  return v === '' ? null : v;
}

async function loadWorkbook(source) {
  const wb = new ExcelJS.Workbook();
  if (Buffer.isBuffer(source)) await wb.xlsx.load(source);
  else await wb.xlsx.readFile(source);
  return wb;
}

function guessPeriod(ws) {
  const a2 = cellVal(ws.getCell(2, 1));
  if (a2 instanceof Date) return `${a2.getUTCFullYear()}-${String(a2.getUTCMonth() + 1).padStart(2, '0')}`;
  const m = String(ws.name).toUpperCase().match(/([A-Z]{3,})\s*(\d{4})/);
  if (m) {
    const i = MONTHS.indexOf(m[1].slice(0, 3));
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  return null;
}

function findHeader(ws) {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    for (let c = 1; c <= 5; c++) {
      const v = cellVal(ws.getCell(r, c));
      if (typeof v === 'string' && /^(staff|name|employee|employee name|staff name)$/i.test(v)) return { row: r, nameCol: c };
    }
  }
  return null;
}

const PERIOD_RE = /^[\d\s,\-]+\/[\d\s,\-\/]+$/;

function readColumns(ws, header) {
  const cols = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const own = cellVal(ws.getCell(header.row, c));
    let label = own;
    if (label === null) {
      for (let up = 1; up <= 3 && header.row - up >= 1 && label === null; up++) {
        const v = cellVal(ws.getCell(header.row - up, c));
        if (typeof v === 'string' && !(c === 1)) label = v;
      }
    }
    if (label === null) continue;
    const isDate = label instanceof Date;
    const text = isDate ? `${label.getUTCDate()}/${label.getUTCMonth() + 1}` : String(label);
    cols.push({ index: c, header: text, isPeriod: isDate || PERIOD_RE.test(text.trim()), isName: c === header.nameCol });
  }
  return cols;
}

function suggestMapping(cols, template) {
  const tcols = template.columns.filter((c) => !c.archived);
  const lookup = new Map();
  for (const t of tcols) {
    [t.label, t.key, ...(t.aliases || [])].forEach((n) => lookup.set(norm(n), t));
  }
  const weekly = tcols.filter((c) => c.group === 'OVERTIME' && c.type === 'number' && c.kind === 'info');
  const periodCols = cols.filter((c) => c.isPeriod);
  const mapped = new Set();
  const out = cols.map((c) => {
    const base = { index: c.index, header: c.header, isPeriod: c.isPeriod, target: null, mode: 'skip' };
    if (c.isName) return { ...base, target: '__name' };
    if (/^(no\.?|s\/?n|#)$/i.test(c.header)) return base;
    if (c.isPeriod) return base; // handled below
    const t = lookup.get(norm(c.header));
    if (t && !mapped.has(t.key)) { mapped.add(t.key); return { ...base, target: t.key }; }
    return base;
  });
  if (weekly.length && periodCols.length === weekly.length) {
    periodCols.forEach((pc, i) => {
      const o = out.find((x) => x.index === pc.index);
      o.target = weekly[i].key;
      mapped.add(weekly[i].key);
    });
  }
  // Mode per mapped column
  const byKey = Object.fromEntries(tcols.map((c) => [c.key, c]));
  for (const o of out) {
    if (!o.target || o.target === '__name') continue;
    const t = byKey[o.target];
    if (t.kind === 'gross' || t.kind === 'net') { o.mode = 'skip'; continue; }
    if (t.type === 'formula' && t.formula) {
      const needs = references(t.formula).filter((k) => byKey[k]);
      o.mode = needs.length && needs.every((k) => mapped.has(k)) ? 'skip' : 'override';
    } else o.mode = 'input';
  }
  return out;
}

// ---- rows ---------------------------------------------------------------------
const SECTION_FIX = { PECKER: 'Rekker', 'SAFFRON MILAN': 'Saffron / Cornells', 'SAFFRON/CORNELLS': 'Saffron / Cornells', 'SAFFRON CORNELLS': 'Saffron / Cornells' };
function cleanSection(s) {
  if (!s) return '';
  const k = String(s).toUpperCase().trim();
  return SECTION_FIX[k] || titleCase(k);
}

function readRows(ws, header, cols) {
  const rows = [];
  const sheetTotals = [];
  let section = cleanSection(cellVal(ws.getCell(header.row - 1, 1)));
  if (/^(no|staff|overtime|allowances|deductions)/i.test(section)) section = '';
  for (let r = header.row + 1; r <= ws.rowCount; r++) {
    const name = cellVal(ws.getCell(r, header.nameCol));
    const first = cellVal(ws.getCell(r, 1));
    const cells = {};
    let numeric = 0;
    for (const c of cols) {
      if (c.isName || c.index === 1) continue;
      const v = cellVal(ws.getCell(r, c.index));
      if (v !== null) { cells[c.index] = v instanceof Date ? null : v; if (typeof v === 'number') numeric++; }
    }
    if (!name) {
      if (typeof first === 'string' && !/^\d+$/.test(first) && numeric === 0) section = cleanSection(first);
      continue;
    }
    if (typeof name !== 'string') continue;
    if (/total/i.test(name)) { sheetTotals.push({ label: name, cells }); continue; }
    if (/^(expenses?|tran)$/i.test(name.trim())) continue;
    rows.push({ rowNumber: r, name: name.replace(/\s+/g, ' ').trim(), section, cells });
  }
  return { rows, sheetTotals };
}

// ---- employee matching -------------------------------------------------------------
function buildDirectory(employees) {
  return employees.map((e) => {
    const others = ((e.notes || '').match(/Other names:\s*([^|]+)/i) || [])[1];
    const otherTokens = others ? nameKey(others).split(' ').filter(Boolean) : [];
    const first = nameKey(e.firstName);
    const last = nameKey(e.lastName);
    return {
      id: String(e._id), e, first, last, otherTokens,
      all: new Set([...first.split(' '), ...last.split(' '), ...otherTokens]),
      aliasKeys: new Set((e.payrollAliases || []).map((a) => nameKey(a))),
    };
  });
}

function matchByName(rawName, dir) {
  let key = nameKey(rawName);
  if (CANONICAL[key]) key = CANONICAL[key];
  const tokens = key.split(' ').filter(Boolean);
  const label = (d) => `${d.e.firstName} ${d.e.lastName}`;

  const byAlias = dir.filter((d) => d.aliasKeys.has(key));
  if (byAlias.length === 1) return { id: byAlias[0].id, score: 100, how: 'remembered name', name: label(byAlias[0]) };

  const m = MATCH[key];
  if (m) {
    const hit = dir.filter((d) => d.first === nameKey(m.firstName) && d.last === nameKey(m.lastName) && (!m.department || d.e.department === m.department));
    if (hit.length === 1) return { id: hit[0].id, score: 100, how: 'name list', name: label(hit[0]) };
  }

  const scored = [];
  for (const d of dir) {
    let s = 0;
    const full = `${d.first} ${d.last}`;
    if (key === full || key === `${d.first} ${d.otherTokens.join(' ')}`.trim()) s = 98;
    else if (tokens[0] === d.first && tokens.slice(1).some((t) => d.last.split(' ').includes(t) || d.otherTokens.includes(t))) s = 92;
    else if (tokens.length >= 2 && tokens.every((t) => d.all.has(t))) s = 85;
    if (s) scored.push({ d, s });
  }
  if (scored.length) {
    const top = Math.max(...scored.map((x) => x.s));
    const best = scored.filter((x) => x.s === top);
    if (best.length === 1) return { id: best[0].d.id, score: top, how: top >= 92 ? 'name' : 'partial name', name: label(best[0].d) };
    return { id: null, score: 0, how: 'ambiguous', ambiguous: best.map((b) => ({ id: b.d.id, name: label(b.d) })) };
  }
  // Weak: a single shared first name or surname - suggest only
  const weak = dir.filter((d) => tokens[0] === d.first || (tokens.length === 1 && (d.last === tokens[0] || d.otherTokens.includes(tokens[0]))));
  if (weak.length === 1) return { id: weak[0].id, score: 60, how: 'first name only - please check', name: label(weak[0]) };
  return { id: null, score: 0, how: 'no match' };
}

// Name first, then the bank account as a safety check. Two staff can share a
// name ("John Mwangi" x2), but not a bank account - so when the sheet row has
// an account number it breaks ties, and if it contradicts the name match the
// row is flagged for a human instead of being filed silently.
const accDigits = (v) => String(v == null ? '' : v).replace(/\D/g, '');
function matchEmployee(rawName, dir, acc) {
  const result = matchByName(rawName, dir);
  const a = accDigits(acc);
  if (a.length < 6) return result;
  const owners = dir.filter((d) => accDigits(d.e.bankAccount) === a);
  if (owners.length !== 1) return result;
  const owner = owners[0];
  const label = `${owner.e.firstName} ${owner.e.lastName}`;
  if (result.id === owner.id) return { ...result, score: 100, how: `${result.how} + bank account` };
  if (!result.id && (result.ambiguous || []).some((x) => x.id === owner.id)) {
    return { id: owner.id, score: 100, how: 'name + bank account', name: label };
  }
  if (result.id && result.id !== owner.id) {
    return { ...result, score: Math.min(result.score, 60), conflict: true, how: `name says ${result.name}, but this bank account belongs to ${label} (${owner.e.department}) - please check` };
  }
  return result;
}

async function directory() {
  return buildDirectory(await Employee.find({}).select('firstName lastName notes department payrollAliases bankAccount').lean());
}

// ---- preview -----------------------------------------------------------------------
async function previewSheet(ws, template, runTypeHint) {
  const header = findHeader(ws);
  if (!header) {
    return { sheet: ws.name, ok: false, reason: 'No header row found. The sheet needs a "STAFF" or "NAME" column heading.' };
  }
  const cols = readColumns(ws, header);
  const mapping = suggestMapping(cols, template);
  const { rows, sheetTotals } = readRows(ws, header, cols);
  const dir = await directory();
  const accIdx = (mapping.find((m) => m.target === 'acc_no') || {}).index;
  const matched = rows.map((r) => ({ ...r, match: matchEmployee(r.name, dir, accIdx ? r.cells[accIdx] : null) }));
  // columns with data that nothing maps to
  const mappedIdx = new Set(mapping.filter((m) => m.target).map((m) => m.index));
  const unmapped = cols
    .filter((c) => !mappedIdx.has(c.index) && !c.isPeriod && !/^(no\.?)$/i.test(c.header))
    .map((c) => ({ index: c.index, header: c.header, filled: rows.filter((r) => typeof r.cells[c.index] === 'number' && r.cells[c.index] !== 0).length }))
    .filter((c) => c.filled > 0);
  const warnings = [];
  if (unmapped.length) warnings.push(`${unmapped.length} column(s) have numbers but aren't mapped: ${unmapped.map((u) => u.header).join(', ')}.`);
  return {
    ok: true,
    sheet: ws.name,
    period: guessPeriod(ws),
    runType: runTypeHint || 'End-Month',
    headerRow: header.row,
    columns: mapping,
    unmapped,
    rows: matched,
    sheetTotals,
    sections: [...new Set(rows.map((r) => r.section).filter(Boolean))],
    warnings,
  };
}

async function listSheets(wb) {
  const out = [];
  for (const ws of wb.worksheets) {
    const header = findHeader(ws);
    out.push({ name: ws.name, rows: ws.rowCount, period: guessPeriod(ws), importable: !!header });
  }
  return out;
}

// ---- creating employees from payroll ------------------------------------------------
async function createEmployeeFromPayroll(rawName, section, period, bank = {}) {
  let key = nameKey(rawName);
  if (CANONICAL[key]) key = CANONICAL[key];
  const parts = key.split(' ').filter(Boolean);
  const firstName = titleCase(parts[0] || 'Unknown');
  const lastName = titleCase(parts.slice(1).join(' ')) || '-';
  const defs = NEW_EMPLOYEE_DEFAULTS[key] || {};
  const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '').replace(/\.-?$/, '');
  let email = `${slug}@placeholder.rekker.co.ke`;
  for (let n = 2; await Employee.exists({ email }); n++) email = `${slug}${n}@placeholder.rekker.co.ke`;
  const branchBySection = { Store: 'Store', Shop: 'Shop', Bellagio: 'Bellagio', 'Saffron / Cornells': 'Saffron / Cornells' };
  const emp = await Employee.create({
    firstName, lastName, email,
    phone: 'N/A',
    department: defs.department || (section && section !== 'Rekker' ? section : 'Operations'),
    role: defs.role || 'Staff',
    branch: defs.branch || branchBySection[section] || 'HQ',
    employmentType: 'Full-Time',
    dateJoined: new Date(`${period || '2026-01'}-01T00:00:00Z`),
    contractStatus: 'Permanent',
    bankName: bank.type || undefined,
    bankAccount: bank.no ? String(bank.no) : undefined,
    payrollAliases: [key],
    notes: 'Added from payroll import. No system login. Please complete this profile (phone, ID, KRA PIN, NSSF, real join date).',
  });
  try { await LeaveBalance.create({ employee: emp._id }); } catch (e) { /* optional */ }
  return emp;
}

// ---- commit ----------------------------------------------------------------------
// mapping: [{ index, target, mode }]   rows: [{ name, section, cells, employee: id | 'new' | null }]
async function commitSheet({ period, runType, mapping, rows, status = 'Draft', replace = false, source = '' }, user) {
  const template = await svc.getTemplate(runType);
  const columns = template.columns.map((c) => c.toObject());
  const byKey = Object.fromEntries(columns.map((c) => [c.key, c]));
  let run = await svc.getRun(period, runType);
  if (run && run.status !== 'Draft') throw svc.httpError(409, `${runType} ${period} is already ${run.status}. Reopen it before importing into it.`);
  if (!run) ({ run } = await svc.createRun(period, runType, { prefill: 'none', notes: source ? `Imported from ${source}` : '' }, user));
  if (replace) await PayrollEntry.deleteMany({ period, runType });

  const active = mapping.filter((m) => m.target && m.target !== '__name' && m.mode !== 'skip' && byKey[m.target]);
  const bankIdx = {
    type: mapping.find((m) => m.target === 'acc_type'),
    no: mapping.find((m) => m.target === 'acc_no'),
  };
  const summary = { period, runType, imported: 0, createdEmployees: [], skipped: [], warnings: [] };
  const seen = new Set();
  let order = (await PayrollEntry.countDocuments({ period, runType })) ? ((await PayrollEntry.findOne({ period, runType }).sort({ order: -1 })).order + 1) : 0;
  const dirCache = { dir: null };

  for (const row of rows) {
    if (row.employee === null || row.employee === 'skip') { summary.skipped.push(row.name); continue; }
    let empId = row.employee;
    let emp;
    if (empId === 'new') {
      // an earlier row (or sheet) may already have created this person
      if (!dirCache.dir) dirCache.dir = await directory();
      const m = matchEmployee(row.name, dirCache.dir, bankIdx.no ? row.cells[bankIdx.no.index] : null);
      if (m.id && m.score >= 85) emp = await Employee.findById(m.id);
      if (!emp) {
        emp = await createEmployeeFromPayroll(row.name, row.section, period, {
          type: bankIdx.type ? row.cells[bankIdx.type.index] : undefined,
          no: bankIdx.no ? row.cells[bankIdx.no.index] : undefined,
        });
        summary.createdEmployees.push(`${emp.firstName} ${emp.lastName}`);
        dirCache.dir = null;
      }
    } else {
      emp = await Employee.findById(empId);
      if (!emp) { summary.skipped.push(`${row.name} (employee not found)`); continue; }
    }
    if (seen.has(String(emp._id))) { summary.warnings.push(`${row.name}: appears twice in this sheet - kept the first row.`); continue; }
    seen.add(String(emp._id));

    // remember this spelling for next time
    const key = nameKey(row.name);
    if (key && !(emp.payrollAliases || []).includes(key)) {
      await Employee.updateOne({ _id: emp._id }, { $addToSet: { payrollAliases: key } });
      dirCache.dir = null;
    }

    const patch = {};
    for (const m of active) {
      const v = row.cells[m.index];
      if (v === undefined || v === null) continue;
      const col = byKey[m.target];
      if (col.type === 'text') patch[m.target] = String(v);
      else if (typeof v === 'number') patch[m.target] = v;
      else if (typeof v === 'string') { try { require('../utils/payrollEngine').parseCellInput(v); patch[m.target] = v; } catch (e) { summary.warnings.push(`${row.name}: ${col.label} "${v}" is not a number - ignored.`); } }
    }

    let entry = await PayrollEntry.findOne({ employee: emp._id, period, runType });
    if (!entry) entry = new PayrollEntry({ employee: emp._id, period, runType, order: order++ });
    entry.section = row.section || entry.section || '';
    entry.payrollName = row.name || entry.payrollName || '';
    entry.values = replace ? {} : entry.values || {};
    svc.applyValues(entry, columns, patch);
    svc.recompute(entry, columns);
    await entry.save();
    summary.imported++;

    // Cross-check against the sheet's own gross / net
    const gm = mapping.find((m) => m.target && byKey[m.target] && byKey[m.target].kind === 'gross');
    const nm = mapping.find((m) => m.target && byKey[m.target] && byKey[m.target].kind === 'net');
    for (const [m, ours, label] of [[gm, entry.gross, 'Gross'], [nm, entry.net, 'Net']]) {
      const theirs = m && row.cells[m.index];
      if (typeof theirs === 'number' && Math.abs(theirs - ours) > 1) summary.warnings.push(`${row.name}: ${label} in the sheet is ${theirs}, system calculates ${ours}.`);
    }
  }

  if (source) { run.importedFrom = source; await run.save(); }
  if (status !== 'Draft') await svc.setStatus(period, runType, 'Approved', user);
  if (status === 'Paid') await svc.setStatus(period, runType, 'Paid', user);
  await svc.audit(user, 'import.commit', { period, runType, summary: `Imported ${summary.imported} rows from ${source || 'Excel'}${summary.createdEmployees.length ? `, created ${summary.createdEmployees.length} employee(s)` : ''}` });
  return summary;
}

// Every month-sheet in a workbook, using automatic mapping and matching.
async function importWorkbookAuto(wb, { runType = 'End-Month', status = 'Approved', source = '', onlySheets } = {}, user) {
  const results = [];
  for (const ws of wb.worksheets) {
    if (onlySheets && !onlySheets.includes(ws.name)) continue;
    const period = guessPeriod(ws);
    if (!period || !findHeader(ws)) { results.push({ sheet: ws.name, skipped: 'not a payroll month sheet' }); continue; }
    const template = await svc.getTemplate(runType);
    const p = await previewSheet(ws, template, runType);
    const rows = p.rows.map((r) => ({
      name: r.name, section: r.section, cells: r.cells,
      employee: r.match.id && r.match.score >= 85 ? r.match.id : 'new',
    }));
    try {
      const s = await commitSheet({ period, runType, mapping: p.columns, rows, status, replace: true, source: source || ws.name }, user);
      results.push({ sheet: ws.name, ...s, unmapped: p.unmapped.map((u) => u.header) });
    } catch (e) {
      results.push({ sheet: ws.name, period, error: e.message });
    }
  }
  return results;
}

module.exports = { createEmployeeFromPayroll, loadWorkbook, listSheets, previewSheet, commitSheet, importWorkbookAuto, matchEmployee, buildDirectory, guessPeriod, nameKey };
