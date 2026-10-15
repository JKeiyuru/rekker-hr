// server/controllers/leaveController.js
const asyncHandler = require('express-async-handler');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Employee = require('../models/Employee');
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

// Populate used by every endpoint that returns leave applications.
const populateLeave = (q) =>
  q
    .populate('employee', 'firstName lastName employeeId department photoUrl')
    .populate('approver', 'firstName lastName')
    .populate('sectionHeadReview.by', 'firstName lastName');

// @desc    Leave applications this user is allowed to recommend on - those of
//          employees in the departments the admin gave them recommending
//          rights for (never their own). ?recommendation=Pending|Recommended|
//          Not Recommended filters by their recommendation status.
// @route   GET /api/leave/to-recommend
const getLeavesToRecommend = asyncHandler(async (req, res) => {
  const departments = req.user.recommendDepartments;
  if (!departments.length) {
    res.status(403);
    throw new Error('You have not been given permission to recommend leave applications');
  }
  const employees = await Employee.find({ department: { $in: departments } }).select('_id');
  let ids = employees.map((e) => e._id);
  if (req.user.employee) ids = ids.filter((id) => id.toString() !== req.user.employee._id.toString());

  const filter = { employee: { $in: ids } };
  const { recommendation, status } = req.query;
  if (recommendation === 'Pending') filter['sectionHeadReview.decision'] = { $in: ['Pending', null] };
  else if (['Recommended', 'Not Recommended'].includes(recommendation)) filter['sectionHeadReview.decision'] = recommendation;
  if (status) filter.status = status;

  res.json({ departments, leaves: await populateLeave(Leave.find(filter).sort({ createdAt: -1 })) });
});

// @desc    Recommendation (Part B) - advisory, doesn't decide the outcome.
//          Only someone the admin has given recommending rights, and only
//          for employees in their departments. Can be changed until
//          management has made the final decision.
// @route   PUT /api/leave/:id/section-head-review
const sectionHeadReview = asyncHandler(async (req, res) => {
  const { decision, comments } = req.body; // decision: 'Recommended' | 'Not Recommended'
  if (!['Recommended', 'Not Recommended'].includes(decision)) {
    res.status(400);
    throw new Error("Decision must be 'Recommended' or 'Not Recommended'");
  }
  if (decision === 'Not Recommended' && !(comments || '').trim()) {
    res.status(400);
    throw new Error('Please give a reason when not recommending a leave application');
  }
  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }
  const employee = await Employee.findById(leave.employee).select('department');
  if (!req.user.recommendDepartments.includes(employee?.department)) {
    res.status(403);
    throw new Error("You haven't been given permission to recommend leave for this employee's department");
  }
  if (req.user.employee && req.user.employee._id.toString() === leave.employee.toString()) {
    res.status(403);
    throw new Error('You cannot recommend your own leave application');
  }
  if (leave.status !== 'Pending') {
    res.status(400);
    throw new Error(`This leave application has already been ${leave.status.toLowerCase()}`);
  }
  const by = req.user.employee?._id;
  leave.sectionHeadReview = {
    decision,
    by,
    byUser: req.user._id,
    byName: req.user.name,
    comments,
    date: new Date(),
  };
  leave.approvalHistory.push({ action: decision, by, byName: req.user.name, notes: comments });
  await leave.save();
  res.json(await populateLeave(Leave.findById(leave._id)));
});

// @desc    Management decision (Part C) - this is what actually sets the
//          final status and, if approved, deducts the leave balance. Allowed
//          for admin/HR/director regardless of the recommendation, including
//          applications marked "Not Recommended".
// @route   PUT /api/leave/:id/decision
const decideLeave = asyncHandler(async (req, res) => {
  const { decision, notes } = req.body; // decision: 'Approved' | 'Rejected'
  const approver = req.user.employee?._id;
  if (!['Approved', 'Rejected'].includes(decision)) {
    res.status(400);
    throw new Error("Decision must be 'Approved' or 'Rejected'");
  }
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
  leave.approvalHistory.push({ action: decision, by: approver, byName: req.user.name, notes });

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
  getLeavesToRecommend,
  applyLeave,
  sectionHeadReview,
  decideLeave,
  cancelLeave,
  deleteLeave,
  getLeaveBalances,
  updateLeaveBalance,
};
