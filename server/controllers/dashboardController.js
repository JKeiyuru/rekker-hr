// server/controllers/dashboardController.js
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Performance = require('../models/Performance');
const Asset = require('../models/Asset');
const Document = require('../models/Document');
const { scopeFilter } = require('../middleware/scope');

// @desc    Aggregated stats for the HR dashboard (company-wide, or scoped to
//          a department manager's own department)
// @route   GET /api/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const employeeIdFilter = scopeFilter(req.scope, '_id');
  const relatedFilter = scopeFilter(req.scope);
  const employeeMatch = req.scope.type === 'department' ? { department: req.scope.department } : {};

  const [
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    suspendedEmployees,
    exitedEmployees,
    contractsExpiringSoon,
    lateToday,
    presentToday,
    absentToday,
    pendingLeaveRequests,
    performanceDue,
    assetsAwaitingReturn,
    documentsExpiring,
    departmentBreakdown,
  ] = await Promise.all([
    Employee.countDocuments(employeeIdFilter),
    Employee.countDocuments({ ...employeeIdFilter, status: 'Active' }),
    Employee.countDocuments({ ...employeeIdFilter, status: 'On Leave' }),
    Employee.countDocuments({ ...employeeIdFilter, status: 'Suspended' }),
    Employee.countDocuments({ ...employeeIdFilter, status: 'Exited' }),
    Employee.countDocuments({
      ...employeeIdFilter,
      contractEndDate: { $gte: today, $lte: in30Days },
      status: 'Active',
    }),
    Attendance.countDocuments({ ...relatedFilter, date: { $gte: today, $lt: tomorrow }, status: 'Late' }),
    Attendance.countDocuments({
      ...relatedFilter,
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['Present', 'Late'] },
    }),
    Attendance.countDocuments({ ...relatedFilter, date: { $gte: today, $lt: tomorrow }, status: 'Absent' }),
    Leave.countDocuments({ ...relatedFilter, status: 'Pending' }),
    Performance.countDocuments({ ...relatedFilter, status: { $in: ['Draft', 'Submitted'] } }),
    Asset.countDocuments({
      ...scopeFilter(req.scope, 'assignedTo'),
      status: 'Returned',
      'returnChecklist.signedOff': false,
    }),
    Document.countDocuments({ ...relatedFilter, status: 'Approved', expiryDate: { $gte: today, $lte: in30Days } }),
    Employee.aggregate([
      { $match: { ...employeeMatch, status: 'Active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    suspendedEmployees,
    exitedEmployees,
    contractsExpiringSoon,
    lateToday,
    presentToday,
    absentToday,
    pendingLeaveRequests,
    performanceDue,
    assetsAwaitingReturn,
    documentsExpiring,
    departmentBreakdown,
  });
});

module.exports = { getDashboardStats };
