// server/controllers/leaveController.js
const asyncHandler = require('express-async-handler');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const { scopeFilter, resolveTargetEmployee, isWithinScope } = require('../middleware/scope');

const balanceFieldMap = {
  Annual: { entitlement: 'annualEntitlement', used: 'annualUsed' },
  Sick: { entitlement: 'sickEntitlement', used: 'sickUsed' },
  Maternity: { entitlement: 'maternityEntitlement', used: 'maternityUsed' },
  Paternity: { entitlement: 'paternityEntitlement', used: 'paternityUsed' },
  Unpaid: { entitlement: null, used: 'unpaidUsed' },
};

// Compassionate/Absence/Study aren't tracked in LeaveBalance, so there's no
// "balance" to snapshot for them - that's expected, not a bug.
const getRemainingBalance = async (employeeId, leaveType) => {
  const field = balanceFieldMap[leaveType];
  if (!field) return null;
  const balance = await LeaveBalance.findOne({ employee: employeeId });
  if (!balance) return null;
  const entitlement = field.entitlement ? balance[field.entitlement] : null;
  const used = balance[field.used] || 0;
  return entitlement === null ? null : entitlement - used;
};

// @desc    Get leave applications (supports ?employee=&status=&leaveType=)
// @route   GET /api/leave
const getLeaves = asyncHandler(async (req, res) => {
  const { employee, status, leaveType } = req.query;
  const filter = { ...scopeFilter(req.scope) };
  if (employee && isWithinScope(req.scope, employee)) filter.employee = employee;
  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;

  const leaves = await Leave.find(filter)
    .populate('employee', 'firstName lastName employeeId department photoUrl')
    .populate('approver', 'firstName lastName')
    .populate('sectionHeadReview.by', 'firstName lastName')
    .sort({ createdAt: -1 });
  res.json(leaves);
});

// @desc    Apply for leave (Part A of the paper form)
// @route   POST /api/leave
const applyLeave = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason, handoverPerson, handoverDepartment, handoverDuties, contactAddress } =
    req.body;
  // Company-wide roles (HR/admin/director/manager) may file leave on behalf
  // of someone else; everyone else is always locked onto their own record.
  const employee = resolveTargetEmployee(req.scope, req.body.employee);
  if (!employee) {
    res.status(400);
    throw new Error('Your login is not linked to an employee record yet');
  }
  const days =
    Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

  const balanceBeforeDays = await getRemainingBalance(employee, leaveType);

  const leave = await Leave.create({
    employee,
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    handoverPerson,
    handoverDepartment,
    handoverDuties,
    contactAddress,
    balanceBeforeDays,
    approvalHistory: [{ action: 'Submitted', by: employee, notes: reason }],
  });
  res.status(201).json(leave);
});

// @desc    Section head recommendation (Part B) - advisory, doesn't decide
//          the outcome, but management sees it before deciding.
// @route   PUT /api/leave/:id/section-head-review
const sectionHeadReview = asyncHandler(async (req, res) => {
  const { decision, by, comments } = req.body; // decision: 'Recommended' | 'Not Recommended'
  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }
  if (!isWithinScope(req.scope, leave.employee)) {
    res.status(403);
    throw new Error('You can only review leave applications within your own department');
  }
  leave.sectionHeadReview = { decision, by, comments, date: new Date() };
  leave.approvalHistory.push({ action: decision, by, notes: comments });
  await leave.save();
  res.json(leave);
});

// @desc    Management decision (Part C) - this is what actually sets the
//          final status and, if approved, deducts the leave balance.
// @route   PUT /api/leave/:id/decision
const decideLeave = asyncHandler(async (req, res) => {
  const { decision, approver, notes } = req.body; // decision: 'Approved' | 'Rejected'
  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }
  if (!isWithinScope(req.scope, leave.employee)) {
    res.status(403);
    throw new Error("You don't have access to this leave application");
  }
  if (leave.status !== 'Pending') {
    res.status(400);
    throw new Error(`This leave application has already been ${leave.status.toLowerCase()}`);
  }

  leave.status = decision;
  leave.approver = approver;
  leave.decisionNotes = notes;
  leave.decisionDate = new Date();
  leave.approvalHistory.push({ action: decision, by: approver, notes });

  if (decision === 'Approved') {
    const field = balanceFieldMap[leave.leaveType];
    if (field) {
      const balance = await LeaveBalance.findOne({ employee: leave.employee });
      if (balance) {
        balance[field.used] = (balance[field.used] || 0) + leave.days;
        await balance.save();
      }
    }
    leave.balanceAfterDays = await getRemainingBalance(leave.employee, leave.leaveType);
  }

  await leave.save();
  res.json(leave);
});

// @desc    Cancel a leave application
// @route   PUT /api/leave/:id/cancel
const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }
  if (!isWithinScope(req.scope, leave.employee)) {
    res.status(403);
    throw new Error("You don't have access to this leave application");
  }
  leave.status = 'Cancelled';
  leave.approvalHistory.push({ action: 'Cancelled', notes: req.body.notes });
  await leave.save();
  res.json(leave);
});

// @desc    Delete a leave record
// @route   DELETE /api/leave/:id
const deleteLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findByIdAndDelete(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Get leave balances (all employees, or ?employee=id)
// @route   GET /api/leave/balances
const getLeaveBalances = asyncHandler(async (req, res) => {
  const { employee } = req.query;
  const filter = { ...scopeFilter(req.scope) };
  if (employee && isWithinScope(req.scope, employee)) filter.employee = employee;
  const balances = await LeaveBalance.find(filter).populate(
    'employee',
    'firstName lastName employeeId department photoUrl'
  );
  res.json(balances);
});

// @desc    Update a leave balance manually (e.g. entitlement adjustment)
// @route   PUT /api/leave/balances/:id
const updateLeaveBalance = asyncHandler(async (req, res) => {
  const balance = await LeaveBalance.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!balance) {
    res.status(404);
    throw new Error('Leave balance not found');
  }
  res.json(balance);
});

module.exports = {
  getLeaves,
  applyLeave,
  sectionHeadReview,
  decideLeave,
  cancelLeave,
  deleteLeave,
  getLeaveBalances,
  updateLeaveBalance,
};
