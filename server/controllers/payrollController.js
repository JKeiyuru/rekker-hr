// server/controllers/payrollController.js
const fs = require('fs');
const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { parseEndMonthSheet, parseMidMonthSheet, listSheetNames } = require('../utils/payrollImport');

// @desc    Get payroll records (supports ?period=&employee=&status=&runType=)
// @route   GET /api/payroll
const getPayrolls = asyncHandler(async (req, res) => {
  const { period, employee, status, runType } = req.query;
  const filter = {};
  if (period) filter.period = period;
  if (employee) filter.employee = employee;
  if (status) filter.status = status;
  if (runType) filter.runType = runType;

  const records = await Payroll.find(filter)
    .populate('employee', 'firstName lastName employeeId department role bankName bankAccount')
    .sort({ period: -1, runType: 1 });
  res.json(records);
});

// @desc    Get one payroll record
// @route   GET /api/payroll/:id
const getPayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id).populate('employee');
  if (!record) {
    res.status(404);
    throw new Error('Payroll record not found');
  }
  res.json(record);
});

// @desc    Create a payroll record for an employee/period/run
// @route   POST /api/payroll
const createPayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.create(req.body);
  res.status(201).json(record);
});

// @desc    Update a payroll record
// @route   PUT /api/payroll/:id
const updatePayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Payroll record not found');
  }
  Object.assign(record, req.body);
  await record.save(); // triggers pre-save total recalculation
  res.json(record);
});

// @desc    Delete a payroll record
// @route   DELETE /api/payroll/:id
const deletePayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findByIdAndDelete(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Payroll record not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Export a payroll period (+ run type) to an Excel workbook
// @route   GET /api/payroll/export/:period?runType=
const exportPayrollPeriod = asyncHandler(async (req, res) => {
  const { period } = req.params;
  const { runType } = req.query;
  const filter = { period };
  if (runType) filter.runType = runType;
  const records = await Payroll.find(filter).populate(
    'employee',
    'firstName lastName employeeId department role bankName bankAccount kraPin nssfNumber nhifNumber'
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rekker HR System';
  const sheet = workbook.addWorksheet(`Payroll ${period}${runType ? ' - ' + runType : ''}`);

  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Run Type', key: 'runType', width: 12 },
    { header: 'Basic Salary', key: 'basicSalary', width: 16 },
    { header: 'Allowances', key: 'allowances', width: 16 },
    { header: 'Overtime', key: 'overtime', width: 14 },
    { header: 'Reimbursements', key: 'reimbursements', width: 16 },
    { header: 'Bonuses', key: 'bonuses', width: 14 },
    { header: 'Gross Pay', key: 'grossPay', width: 16 },
    { header: 'Deductions', key: 'deductions', width: 16 },
    { header: 'Net Pay', key: 'netPay', width: 16 },
    { header: 'Bank Name', key: 'bankName', width: 18 },
    { header: 'Bank Account', key: 'bankAccount', width: 18 },
    { header: 'KRA PIN', key: 'kraPin', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6001C' } };

  records.forEach((r) => {
    const allowancesTotal = (r.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
    const bonusesTotal = (r.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
    const reimbursementsTotal = (r.expenseReimbursements || []).reduce((s, x) => s + (x.amount || 0), 0);
    const overtimePay =
      r.overtimeAmount != null ? r.overtimeAmount : (r.overtimeHours || 0) * (r.overtimeRate || 0);
    sheet.addRow({
      employeeId: r.employee?.employeeId,
      name: `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`,
      department: r.employee?.department,
      role: r.employee?.role,
      runType: r.runType,
      basicSalary: r.basicSalary,
      allowances: allowancesTotal,
      overtime: overtimePay,
      reimbursements: reimbursementsTotal,
      bonuses: bonusesTotal,
      grossPay: r.grossPay,
      deductions: r.totalDeductions,
      netPay: r.netPay,
      bankName: r.employee?.bankName,
      bankAccount: r.employee?.bankAccount,
      kraPin: r.employee?.kraPin,
      status: r.status,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=payroll-${period}${runType ? '-' + runType : ''}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// --- Historical import -----------------------------------------------

// @desc    List sheet names in an uploaded workbook (so the UI can offer a
//          month picker for a multi-sheet file like PAYROLL_2026.xlsx)
// @route   POST /api/payroll/import/sheets
const listImportSheets = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('A file is required');
  }
  try {
    const sheets = await listSheetNames(req.file.path);
    res.json({ sheets });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// @desc    Parse an uploaded payroll file and return a preview, with a
//          best-guess employee match per row - nothing is saved yet.
// @route   POST /api/payroll/import/preview
const previewImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('A file is required');
  }
  const { format, sheet } = req.body; // format: 'end-month' | 'mid-month'
  try {
    const rows =
      format === 'mid-month'
        ? await parseMidMonthSheet(req.file.path, sheet)
        : await parseEndMonthSheet(req.file.path, sheet);
    res.json({ rows });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// @desc    Commit a reviewed/corrected import preview to the database.
//          Rows with "createEmployee" create a bare employee record first
//          (no login account) - matching exactly how Rekker wants
//          store/shop/site staff added: visible in the system, no account.
// @route   POST /api/payroll/import/commit
const commitImport = asyncHandler(async (req, res) => {
  const { period, runType, rows, importLabel } = req.body;
  if (!period || !runType || !Array.isArray(rows)) {
    res.status(400);
    throw new Error('period, runType and rows are required');
  }

  const results = { created: 0, skipped: 0, newEmployees: 0, errors: [] };

  for (const row of rows) {
    try {
      let employeeId = row.employeeId;

      if (!employeeId && row.createEmployee) {
        const parts = (row.rawName || '').trim().split(/\s+/);
        const newEmployee = await Employee.create({
          firstName: parts[0] || row.rawName,
          lastName: parts.slice(1).join(' ') || '-',
          email: `${(parts[0] || 'staff').toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 10000)}@placeholder.rekker.co.ke`,
          phone: 'Unknown',
          department: row.department || 'Unassigned',
          role: row.role || 'Staff',
          branch: row.branch || 'HQ',
          dateJoined: new Date(),
          notes: `Added via payroll import (${importLabel || period}). Email is a placeholder - update with their real contact details.`,
        });
        employeeId = newEmployee._id;
        results.newEmployees++;
      }

      if (!employeeId) {
        results.skipped++;
        results.errors.push(`${row.rawName}: no employee selected or created - skipped`);
        continue;
      }

      const payload = {
        employee: employeeId,
        period,
        runType,
        basicSalary: row.basicSalary || 0,
        overtimeAmount: row.overtimeAmount,
        allowances: row.allowances || [],
        deductions: row.deductions || [],
        expenseReimbursements: row.expenseReimbursements || [],
        notes: row.notes,
        status: 'Paid', // historical imports represent pay that's already happened
        importedFrom: importLabel || `import-${period}-${runType}`,
      };

      // findOneAndUpdate's upsert bypasses document middleware, so it would
      // skip the pre-save hook that computes grossPay/netPay - find-or-new
      // + .save() instead, so totals are always correctly recalculated.
      let record = await Payroll.findOne({ employee: employeeId, period, runType });
      if (record) {
        Object.assign(record, payload);
      } else {
        record = new Payroll(payload);
      }
      await record.save();
      results.created++;
    } catch (err) {
      results.errors.push(`${row.rawName}: ${err.message}`);
    }
  }

  res.status(201).json(results);
});

module.exports = {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  deletePayroll,
  exportPayrollPeriod,
  listImportSheets,
  previewImport,
  commitImport,
};
