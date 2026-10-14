// server/services/payrollService.js
// Business logic for templates, pay runs and rows. Controllers stay thin and
// the import script reuses the same functions.
const PayrollTemplate = require('../models/PayrollTemplate');
const PayrollRun = require('../models/PayrollRun');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollAudit = require('../models/PayrollAudit');
const Employee = require('../models/Employee');
const defaults = require('../utils/defaultTemplates');
const { computeEntry, validateColumns, parseCellInput, slugify, hasValue, round2 } = require('../utils/payrollEngine');

const RUN_TYPES = ['End-Month', 'Mid-Month'];
const EMP_FIELDS = 'employeeId firstName lastName department role branch bankName bankAccount kraPin nssfNumber status email';

const httpError = (code, msg) => { const e = new Error(msg); e.statusCode = code; return e; };

async function audit(user, action, { period, runType, summary } = {}) {
  try {
    await PayrollAudit.create({ user: user && user._id, userName: user && user.name, action, period, runType, summary });
  } catch (e) { /* audit must never break a payroll action */ }
}

function assertRunType(runType) {
  if (!RUN_TYPES.includes(runType)) throw httpError(400, `runType must be one of ${RUN_TYPES.join(', ')}`);
}

// ---- templates ------------------------------------------------------------
async function getTemplate(runType) {
  assertRunType(runType);
  let t = await PayrollTemplate.findOne({ runType });
  if (!t) t = await PayrollTemplate.create(JSON.parse(JSON.stringify(defaults[runType])));
  return t;
}

async function saveTemplate(runType, body, user) {
  const t = await getTemplate(runType);
  const incoming = Array.isArray(body.columns) ? body.columns : t.columns.map((c) => c.toObject());
  const used = new Set();
  const columns = incoming.map((c) => {
    let key = c.key && /^[a-z][a-z0-9_]*$/.test(c.key) ? c.key : slugify(c.label);
    let n = 2;
    const base = key;
    while (used.has(key)) key = `${base}_${n++}`;
    used.add(key);
    const kind = ['info', 'earning', 'deduction', 'gross', 'net'].includes(c.kind) ? c.kind : 'info';
    const type = kind === 'gross' || kind === 'net' ? 'formula' : ['text', 'number', 'formula'].includes(c.type) ? c.type : 'number';
    return {
      key,
      label: String(c.label || '').trim(),
      group: String(c.group || '').trim().toUpperCase(),
      type,
      kind,
      formula: String(c.formula || '').trim(),
      system: kind === 'gross' || kind === 'net',
      showOnPayslip: !!c.showOnPayslip,
      payslipLabel: String(c.payslipLabel || '').trim(),
      carryForward: !!c.carryForward,
      inTotals: c.inTotals !== false,
      aliases: (c.aliases || []).map((a) => String(a).trim()).filter(Boolean),
      archived: !!c.archived,
    };
  });
  // gross/net columns with an empty formula use the built-in logic
  columns.forEach((c) => { if (c.type === 'formula' && c.kind !== 'gross' && c.kind !== 'net' && !c.formula) c.formula = ''; });

  const errors = validateColumns(columns.map((c) => ({ ...c, type: (c.kind === 'gross' || c.kind === 'net') && !c.formula ? 'number' : c.type })));
  // gross/net with no formula are valid (built-in logic): drop errors that only complain about that
  const real = errors.filter((e) => !/add a formula or change the column type/.test(e));
  if (real.length) throw httpError(400, real.join(' '));

  t.columns = columns;
  if (Array.isArray(body.sections)) t.sections = body.sections.map((s) => String(s).trim()).filter(Boolean);
  if (body.payslip) t.payslip = { ...(t.payslip.toObject ? t.payslip.toObject() : t.payslip), ...body.payslip };
  if (body.name) t.name = body.name;
  t.version += 1;
  t.updatedBy = user && user._id;
  await t.save();

  // Draft runs pick up the new layout straight away; approved/paid runs are
  // frozen by their snapshot.
  const drafts = await PayrollRun.find({ runType, status: 'Draft' });
  for (const r of drafts) await recalcRun(r.period, runType, columns);
  await audit(user, 'template.save', { runType, summary: `Template saved (v${t.version}, ${columns.filter((c) => !c.archived).length} columns)` });
  return t;
}

function columnsForRun(run, template) {
  const snap = run && run.snapshot;
  return (snap && snap.columns) || template.columns.map((c) => (c.toObject ? c.toObject() : c));
}

// ---- entries ----------------------------------------------------------------
function recompute(entry, columns) {
  const r = computeEntry(columns, entry.values || {}, entry.cellFormulas || {});
  entry.computed = r.computed;
  entry.gross = r.gross;
  entry.net = r.net;
  entry.totalDeductions = r.totalDeductions;
  entry.markModified('computed');
  return entry;
}

async function recalcRun(period, runType, columns) {
  const entries = await PayrollEntry.find({ period, runType });
  for (const e of entries) { recompute(e, columns); await e.save(); }
  return entries.length;
}

// Applies { key: rawInput } to an entry using the column types.
function applyValues(entry, columns, patch) {
  const byKey = Object.fromEntries(columns.filter((c) => !c.archived).map((c) => [c.key, c]));
  entry.values = { ...(entry.values || {}) };
  entry.cellFormulas = { ...(entry.cellFormulas || {}) };
  for (const [key, raw] of Object.entries(patch || {})) {
    const c = byKey[key];
    if (!c) throw httpError(400, `Unknown column "${key}"`);
    if (c.type === 'text') {
      entry.values[key] = hasValue(raw) ? String(raw).trim() : null;
      delete entry.cellFormulas[key];
      continue;
    }
    let parsed;
    try { parsed = parseCellInput(raw); } catch (e) { throw httpError(400, `${c.label}: ${e.message}`); }
    entry.values[key] = parsed.value;
    if (parsed.expr) entry.cellFormulas[key] = parsed.expr; else delete entry.cellFormulas[key];
  }
  entry.markModified('values');
  entry.markModified('cellFormulas');
}

// ---- runs ---------------------------------------------------------------------
async function getRun(period, runType) {
  return PayrollRun.findOne({ period, runType });
}

function assertEditable(run) {
  if (!run) throw httpError(404, 'That pay run has not been started yet.');
  if (run.status !== 'Draft') throw httpError(409, `This run is ${run.status}. Reopen it to make changes.`);
}

async function createRun(period, runType, { prefill = 'previous', notes = '' } = {}, user) {
  assertRunType(runType);
  if (!/^\d{4}-\d{2}$/.test(period || '')) throw httpError(400, 'period must look like 2026-10');
  if (await getRun(period, runType)) throw httpError(409, 'That pay run already exists.');
  const template = await getTemplate(runType);
  const run = await PayrollRun.create({ period, runType, notes, createdBy: user && user._id });
  let copied = 0;
  if (prefill === 'previous') {
    const prev = await PayrollRun.findOne({ runType, period: { $lt: period } }).sort({ period: -1 });
    if (prev) {
      const prevEntries = await PayrollEntry.find({ period: prev.period, runType }).sort({ order: 1 }).populate('employee', 'status');
      const carry = template.columns.filter((c) => !c.archived && c.carryForward && c.type !== 'formula');
      let order = 0;
      for (const pe of prevEntries) {
        if (!pe.employee || pe.employee.status === 'Exited') continue;
        const e = new PayrollEntry({ employee: pe.employee._id, period, runType, section: pe.section, payrollName: pe.payrollName || '', order: order++ });
        e.values = {};
        e.cellFormulas = {};
        for (const c of carry) {
          if (hasValue(pe.values && pe.values[c.key])) {
            e.values[c.key] = pe.values[c.key];
            if (pe.cellFormulas && pe.cellFormulas[c.key]) e.cellFormulas[c.key] = pe.cellFormulas[c.key];
          }
        }
        recompute(e, template.columns.map((c) => c.toObject()));
        await e.save();
        copied++;
      }
    }
  }
  await audit(user, 'run.create', { period, runType, summary: `Started ${runType} run for ${period} (${copied} staff carried forward)` });
  return { run, copied };
}

async function setStatus(period, runType, status, user) {
  const run = await getRun(period, runType);
  if (!run) throw httpError(404, 'Run not found');
  if (!['Draft', 'Approved', 'Paid'].includes(status)) throw httpError(400, 'Bad status');
  if (status === run.status) return run;
  const template = await getTemplate(runType);
  const isDirectorOrAdmin = user && ['admin', 'director'].includes(user.role);

  if (status === 'Approved') {
    if (run.status === 'Draft') {
      const count = await PayrollEntry.countDocuments({ period, runType });
      if (!count) throw httpError(400, 'Add at least one employee before approving.');
      const columns = template.columns.map((c) => c.toObject());
      await recalcRun(period, runType, columns);
      run.snapshot = { columns, payslip: template.payslip.toObject(), sections: template.sections };
      run.approvedBy = user._id;
      run.approvedAt = new Date();
    } else if (run.status === 'Paid') {
      if (!isDirectorOrAdmin) throw httpError(403, 'Only an admin or director can reopen a paid run.');
      run.paidAt = undefined;
    }
  } else if (status === 'Paid') {
    if (run.status !== 'Approved') throw httpError(409, 'Approve the run before marking it paid.');
    run.paidAt = new Date();
  } else if (status === 'Draft') {
    if (run.status === 'Paid' && !isDirectorOrAdmin) throw httpError(403, 'Only an admin or director can reopen a paid run.');
    run.snapshot = null;
    run.approvedBy = undefined;
    run.approvedAt = undefined;
    run.paidAt = undefined;
    await recalcRun(period, runType, template.columns.map((c) => c.toObject()));
  }
  run.status = status;
  run.markModified('snapshot');
  await run.save();
  await audit(user, `run.${status.toLowerCase()}`, { period, runType, summary: `${runType} ${period} set to ${status}` });
  return run;
}

async function deleteRun(period, runType, user) {
  const run = await getRun(period, runType);
  if (!run) throw httpError(404, 'Run not found');
  if (run.status !== 'Draft') throw httpError(409, 'Only a draft run can be deleted. Reopen it first.');
  const n = await PayrollEntry.deleteMany({ period, runType });
  await run.deleteOne();
  await audit(user, 'run.delete', { period, runType, summary: `Deleted ${runType} ${period} (${n.deletedCount} rows)` });
}

// Adds an employee row to a draft run.
async function addEntry(period, runType, { employee, section, values }, user) {
  const run = await getRun(period, runType);
  assertEditable(run);
  const template = await getTemplate(runType);
  const emp = await Employee.findById(employee);
  if (!emp) throw httpError(404, 'Employee not found');
  if (await PayrollEntry.findOne({ employee, period, runType })) throw httpError(409, `${emp.firstName} ${emp.lastName} is already in this run.`);
  const last = await PayrollEntry.findOne({ period, runType }).sort({ order: -1 });
  const e = new PayrollEntry({ employee, period, runType, section: section || '', order: last ? last.order + 1 : 0 });
  e.values = {};
  e.cellFormulas = {};
  const cols = template.columns.map((c) => c.toObject());
  // Pre-fill bank details from the employee record
  const pre = {};
  if (emp.bankName) pre.acc_type = emp.bankName;
  if (emp.bankAccount) pre.acc_no = emp.bankAccount;
  applyValues(e, cols, { ...Object.fromEntries(Object.entries(pre).filter(([k]) => cols.some((c) => c.key === k && !c.archived))), ...(values || {}) });
  recompute(e, cols);
  await e.save();
  await audit(user, 'row.add', { period, runType, summary: `Added ${emp.firstName} ${emp.lastName}` });
  return e;
}

async function patchEntry(id, patch, user) {
  const e = await PayrollEntry.findById(id);
  if (!e) throw httpError(404, 'Row not found');
  const run = await getRun(e.period, e.runType);
  assertEditable(run);
  const template = await getTemplate(e.runType);
  const cols = template.columns.map((c) => c.toObject());
  if (patch.values) applyValues(e, cols, patch.values);
  if (patch.section !== undefined) e.section = String(patch.section || '');
  if (patch.notes !== undefined) e.notes = String(patch.notes || '');
  if (patch.order !== undefined) e.order = Number(patch.order) || 0;
  recompute(e, cols);
  await e.save();
  return e;
}

async function removeEntry(id, user) {
  const e = await PayrollEntry.findById(id).populate('employee', 'firstName lastName');
  if (!e) throw httpError(404, 'Row not found');
  const run = await getRun(e.period, e.runType);
  assertEditable(run);
  await e.deleteOne();
  await audit(user, 'row.remove', { period: e.period, runType: e.runType, summary: `Removed ${e.employee ? e.employee.firstName + ' ' + e.employee.lastName : 'row'}` });
}

// ---- reading ----------------------------------------------------------------------
function sumTotals(entries, columns) {
  const totals = { count: entries.length, gross: 0, net: 0, totalDeductions: 0, columns: {} };
  for (const e of entries) {
    totals.gross += e.gross || 0;
    totals.net += e.net || 0;
    totals.totalDeductions += e.totalDeductions || 0;
    for (const c of columns) {
      if (c.archived || c.type === 'text') continue;
      totals.columns[c.key] = (totals.columns[c.key] || 0) + (Number(e.computed && e.computed[c.key]) || 0);
    }
  }
  totals.gross = round2(totals.gross);
  totals.net = round2(totals.net);
  totals.totalDeductions = round2(totals.totalDeductions);
  Object.keys(totals.columns).forEach((k) => { totals.columns[k] = round2(totals.columns[k]); });
  return totals;
}

async function loadRun(period, runType) {
  const template = await getTemplate(runType);
  const run = await getRun(period, runType);
  const columns = columnsForRun(run, template);
  const entries = run
    ? await PayrollEntry.find({ period, runType }).sort({ order: 1, createdAt: 1 }).populate('employee', EMP_FIELDS).lean()
    : [];
  return { template, run, columns, entries, totals: sumTotals(entries, columns) };
}

async function listRuns({ year, runType } = {}) {
  const q = {};
  if (runType) q.runType = runType;
  if (year) q.period = new RegExp(`^${year}-`);
  const runs = await PayrollRun.find(q).sort({ period: -1, runType: 1 }).lean();
  const agg = await PayrollEntry.aggregate([
    { $match: q },
    { $group: { _id: { period: '$period', runType: '$runType' }, count: { $sum: 1 }, gross: { $sum: '$gross' }, net: { $sum: '$net' } } },
  ]);
  const map = Object.fromEntries(agg.map((a) => [`${a._id.period}|${a._id.runType}`, a]));
  return runs.map((r) => {
    const a = map[`${r.period}|${r.runType}`] || {};
    return { ...r, snapshot: undefined, count: a.count || 0, gross: round2(a.gross || 0), net: round2(a.net || 0) };
  });
}

module.exports = {
  RUN_TYPES, EMP_FIELDS, httpError, audit, getTemplate, saveTemplate, columnsForRun, recompute, recalcRun,
  applyValues, getRun, assertEditable, createRun, setStatus, deleteRun, addEntry, patchEntry, removeEntry,
  sumTotals, loadRun, listRuns,
};
