// server/controllers/payrollController.js
const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');
const Payroll = require('../models/Payroll');

// @desc    Get payroll records (supports ?period=&employee=&status=)
// @route   GET /api/payroll
const getPayrolls = asyncHandler(async (req, res) => {
  const { period, employee, status } = req.query;
  const filter = {};
  if (period) filter.period = period;
  if (employee) filter.employee = employee;
  if (status) filter.status = status;

  const records = await Payroll.find(filter)
    .populate('employee', 'firstName lastName employeeId department role bankName bankAccount')
    .sort({ period: -1 });
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

// @desc    Create a payroll record for an employee/period
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

// @desc    Export a payroll period to an Excel workbook
// @route   GET /api/payroll/export/:period
const exportPayrollPeriod = asyncHandler(async (req, res) => {
  const { period } = req.params;
  const records = await Payroll.find({ period }).populate(
    'employee',
    'firstName lastName employeeId department role bankName bankAccount kraPin nssfNumber nhifNumber'
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rekker HR System';
  const sheet = workbook.addWorksheet(`Payroll ${period}`);

  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Basic Salary', key: 'basicSalary', width: 16 },
    { header: 'Allowances', key: 'allowances', width: 16 },
    { header: 'Overtime', key: 'overtime', width: 14 },
    { header: 'Bonuses', key: 'bonuses', width: 14 },
    { header: 'Gross Pay', key: 'grossPay', width: 16 },
    { header: 'Deductions', key: 'deductions', width: 16 },
    { header: 'Net Pay', key: 'netPay', width: 16 },
    { header: 'Bank Name', key: 'bankName', width: 18 },
    { header: 'Bank Account', key: 'bankAccount', width: 18 },
    { header: 'KRA PIN', key: 'kraPin', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD6001C' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  records.forEach((r) => {
    const allowancesTotal = (r.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
    const bonusesTotal = (r.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
    const overtimePay = (r.overtimeHours || 0) * (r.overtimeRate || 0);
    sheet.addRow({
      employeeId: r.employee?.employeeId,
      name: `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`,
      department: r.employee?.department,
      role: r.employee?.role,
      basicSalary: r.basicSalary,
      allowances: allowancesTotal,
      overtime: overtimePay,
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

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename=payroll-${period}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  deletePayroll,
  exportPayrollPeriod,
};
