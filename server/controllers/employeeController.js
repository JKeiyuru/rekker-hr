// server/controllers/employeeController.js
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Asset = require('../models/Asset');
const { scopeFilter, isWithinScope } = require('../middleware/scope');

// @desc    Get all employees (supports ?status=&department=&search=)
// @route   GET /api/employees
const getEmployees = asyncHandler(async (req, res) => {
  const { status, department, branch, search } = req.query;
  const filter = { ...scopeFilter(req.scope, '_id') };
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (branch) filter.branch = branch;
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const employees = await Employee.find(filter)
    .populate('reportingManager', 'firstName lastName employeeId')
    .sort({ createdAt: -1 });
  res.json(employees);
});

// @desc    Get single employee
// @route   GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
  if (!isWithinScope(req.scope, req.params.id)) {
    res.status(403);
    throw new Error("You don't have access to this employee record");
  }
  const employee = await Employee.findById(req.params.id).populate(
    'reportingManager',
    'firstName lastName employeeId role'
  );
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json(employee);
});

// @desc    Create employee
// @route   POST /api/employees
const createEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.create(req.body);
  // Auto-create a leave balance record for the new employee
  await LeaveBalance.create({ employee: employee._id });
  res.status(201).json(employee);
});

// @desc    Update employee
// @route   PUT /api/employees/:id
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json(employee);
});

// @desc    Delete employee
// @route   DELETE /api/employees/:id
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  // Deleting the HR record shouldn't leave a dangling active login, an
  // orphaned leave balance, or assets stuck "assigned" to someone who no
  // longer exists in the system.
  await User.updateMany({ employee: employee._id, isSuperAdmin: { $ne: true } }, { isActive: false });
  await LeaveBalance.deleteMany({ employee: employee._id });
  await Asset.updateMany({ assignedTo: employee._id }, { assignedTo: null });
  res.json({ message: 'Employee deleted successfully' });
});

// @desc    Distinct list of departments/branches (for filters/dropdowns)
// @route   GET /api/employees/meta/options
const getEmployeeOptions = asyncHandler(async (req, res) => {
  const departments = await Employee.distinct('department');
  const branches = await Employee.distinct('branch');
  const roles = await Employee.distinct('role');
  res.json({ departments, branches, roles });
});

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeOptions,
};
