// server/controllers/payrollController.js
// Payroll workspace API (accountant / admin / director / hr).
const fs = require('fs');
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const PayrollEntry = require('../models/PayrollEntry');
const PayrollAudit = require('../models/PayrollAudit');
const svc = require('../services/payrollService');
const imp = require('../services/payrollImport');
const exp = require('../services/payrollExport');
const { PAYROLL_MANAGE_ROLES, PAYROLL_APPROVE_ROLES } = require('../config/roles');

const runTypeOf = (req) => req.query.runType || req.body.runType || req.params.runType || 'End-Month';

// What can this user do? The UI hides buttons accordingly; the routes enforce it.
const getMeta = asyncHandler(async (req, res) => {
  res.json({
    canManage: PAYROLL_MANAGE_ROLES.includes(req.user.role),
    canApprove: PAYROLL_APPROVE_ROLES.includes(req.user.role),
    canReopenPaid: ['admin', 'director'].includes(req.user.role),
    runTypes: svc.RUN_TYPES,
  });
});

// ---- templates ----
const getTemplate = asyncHandler(async (req, res) => {
  res.json(await svc.getTemplate(req.params.runType));
});
const saveTemplate = asyncHandler(async (req, res) => {
  res.json(await svc.saveTemplate(req.params.runType, req.body, req.user));
});

// ---- runs ----
const listRuns = asyncHandler(async (req, res) => {
  res.json(await svc.listRuns({ year: req.query.year, runType: req.query.runType }));
});
const getRun = asyncHandler(async (req, res) => {
  const { period, runType } = req.params;
  const data = await svc.loadRun(period, runType);
  res.json({
    run: data.run && { ...data.run.toObject(), snapshot: undefined },
    frozen: !!(data.run && data.run.snapshot),
    template: { name: data.template.name, sections: data.template.sections, payslip: data.template.payslip, version: data.template.version },
    columns: data.columns,
    entries: data.entries,
    totals: data.totals,
  });
});
const createRun = asyncHandler(async (req, res) => {
  const { period, runType = 'End-Month', prefill = 'previous' } = req.body;
  const r = await svc.createRun(period, runType, { prefill }, req.user);
  res.status(201).json({ run: r.run, copied: r.copied });
});
const setStatus = asyncHandler(async (req, res) => {
  const run = await svc.setStatus(req.params.period, req.params.runType, req.body.status, req.user);
  res.json({ ...run.toObject(), snapshot: undefined });
});
const deleteRun = asyncHandler(async (req, res) => {
  await svc.deleteRun(req.params.period, req.params.runType, req.user);
  res.json({ message: 'Run deleted' });
});
const recalc = asyncHandler(async (req, res) => {
  const { period, runType } = req.params;
  const run = await svc.getRun(period, runType);
  svc.assertEditable(run);
  const t = await svc.getTemplate(runType);
  const n = await svc.recalcRun(period, runType, t.columns.map((c) => c.toObject()));
  res.json({ recalculated: n });
});

// ---- rows ----
const addEntry = asyncHandler(async (req, res) => {
  const { period, runType } = req.params;
  const e = await svc.addEntry(period, runType, req.body, req.user);
  res.status(201).json(await PayrollEntry.findById(e._id).populate('employee', svc.EMP_FIELDS).lean());
});
const patchEntry = asyncHandler(async (req, res) => {
  const e = await svc.patchEntry(req.params.id, req.body, req.user);
  res.json(await PayrollEntry.findById(e._id).populate('employee', svc.EMP_FIELDS).lean());
});
// Several cells at once (paste from Excel): [{ id, values }]
const patchMany = asyncHandler(async (req, res) => {
  const out = [];
  for (const item of req.body.updates || []) {
    const e = await svc.patchEntry(item.id, { values: item.values }, req.user);
    out.push(await PayrollEntry.findById(e._id).populate('employee', svc.EMP_FIELDS).lean());
  }
  res.json(out);
});
const removeEntry = asyncHandler(async (req, res) => {
  await svc.removeEntry(req.params.id, req.user);
  res.json({ message: 'Removed' });
});

// ---- staff ----
const listStaff = asyncHandler(async (req, res) => {
  const emps = await Employee.find({ status: { $ne: 'Exited' } })
    .select('employeeId firstName lastName department role branch bankName bankAccount email')
    .sort({ firstName: 1 })
    .lean();
  res.json(emps);
});
const createStaff = asyncHandler(async (req, res) => {
  const { name, section, bankName, bankAccount, period } = req.body;
  if (!name || !String(name).trim()) { res.status(400); throw new Error('Enter the person\'s name'); }
  const emp = await imp.createEmployeeFromPayroll(name, section, period || new Date().toISOString().slice(0, 7), { type: bankName, no: bankAccount });
  res.status(201).json(emp);
});

// ---- import ----
const withFile = (handler) =>
  asyncHandler(async (req, res) => {
    if (!req.file) { res.status(400); throw new Error('Choose an Excel file (.xlsx) to upload'); }
    try {
      const wb = await imp.loadWorkbook(req.file.path);
      await handler(req, res, wb);
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  });

const importSheets = withFile(async (req, res, wb) => {
  res.json({ sheets: await imp.listSheets(wb) });
});
const importPreview = withFile(async (req, res, wb) => {
  const ws = wb.getWorksheet(req.body.sheet) || wb.worksheets[0];
  const runType = req.body.runType || 'End-Month';
  const template = await svc.getTemplate(runType);
  res.json({ ...(await imp.previewSheet(ws, template, runType)), templateColumns: template.columns.filter((c) => !c.archived) });
});
const importAuto = withFile(async (req, res, wb) => {
  const only = req.body.sheets ? JSON.parse(req.body.sheets) : undefined;
  const results = await imp.importWorkbookAuto(wb, { runType: req.body.runType || 'End-Month', status: req.body.status || 'Approved', source: req.file.originalname, onlySheets: only }, req.user);
  res.json({ results });
});
const importCommit = asyncHandler(async (req, res) => {
  const { period, runType = 'End-Month', mapping, rows, status = 'Draft', replace = false, source, remember } = req.body;
  if (!period || !Array.isArray(mapping) || !Array.isArray(rows)) { res.status(400); throw new Error('Nothing to import'); }
  if (remember) {
    const t = await svc.getTemplate(runType);
    for (const m of mapping) {
      if (!m.target || m.target === '__name' || !m.header) continue;
      const c = t.columns.find((x) => x.key === m.target);
      if (c && !c.aliases.some((a) => a.toUpperCase() === String(m.header).toUpperCase()) && c.label.toUpperCase() !== String(m.header).toUpperCase()) c.aliases.push(m.header);
    }
    await t.save();
  }
  res.json(await imp.commitSheet({ period, runType, mapping, rows, status, replace, source }, req.user));
});

// ---- exports / reports ----
const sendXlsx = (res, buf, name) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(Buffer.from(buf));
};
const exportRun = asyncHandler(async (req, res) => {
  const { period, runType } = req.params;
  sendXlsx(res, await exp.exportRunXlsx(period, runType), `Rekker-${runType}-Payroll-${period}.xlsx`);
});
const exportBank = asyncHandler(async (req, res) => {
  const { period, runType } = req.params;
  if (req.query.format === 'csv') {
    const rows = await exp.bankSchedule(period, runType);
    const csv = ['Bank,Account No,Name,Amount', ...rows.map((r) => [r.bank, `"${r.account}"`, `"${r.name}"`, r.net.toFixed(2)].join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Rekker-payments-${runType}-${period}.csv"`);
    return res.send(csv);
  }
  sendXlsx(res, await exp.exportBankXlsx(period, runType), `Rekker-Payment-Schedule-${runType}-${period}.xlsx`);
});
const summary = asyncHandler(async (req, res) => {
  res.json(await exp.yearSummary({ year: req.query.year || new Date().getFullYear(), runType: runTypeOf(req) }));
});
const exportSummary = asyncHandler(async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  sendXlsx(res, await exp.exportYearXlsx({ year, runType: runTypeOf(req) }), `Rekker-Payroll-Summary-${year}.xlsx`);
});
const getAudit = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.period) q.period = req.query.period;
  res.json(await PayrollAudit.find(q).sort({ at: -1 }).limit(200).lean());
});

module.exports = {
  getMeta, getTemplate, saveTemplate, listRuns, getRun, createRun, setStatus, deleteRun, recalc,
  addEntry, patchEntry, patchMany, removeEntry, listStaff, createStaff,
  importSheets, importPreview, importAuto, importCommit,
  exportRun, exportBank, summary, exportSummary, getAudit,
};
