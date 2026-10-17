// server/controllers/payrollLinkController.js
const asyncHandler = require('express-async-handler');
const { auditPayrollLinks, moveEntries } = require('../utils/payrollLinks');
const PayrollAudit = require('../models/PayrollAudit');

// @route GET /api/payroll-links
const audit = asyncHandler(async (req, res) => {
  res.json(await auditPayrollLinks());
});

// @route POST /api/payroll-links/move   { from, to, payrollNames: [] }
const move = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await moveEntries(req.body || {});
  } catch (err) {
    res.status(err.status || 400);
    throw err;
  }
  await PayrollAudit.create({
    user: req.user._id,
    userName: req.user.name,
    action: 'payroll.reassign',
    summary: `Moved ${result.moved.length} payroll row(s) from ${result.from} to ${result.to}${result.skipped.length ? `; skipped ${result.skipped.length}` : ''}`,
  });
  res.json(result);
});

module.exports = { audit, move };
