// server/controllers/userController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { resolveAccess } = require('../utils/userAccess');

const populateUser = (q) => q.populate('employee', 'firstName lastName employeeId department');

const getUsers = asyncHandler(async (req, res) => {
  const users = await populateUser(User.find()).sort({ createdAt: -1 });
  res.json(users);
});

// Departments that exist on employee records - feeds the department pickers
// on the role editor.
const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Employee.distinct('department');
  res.json(departments.filter(Boolean).sort((a, b) => a.localeCompare(b)));
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, role, isActive, employee, password } = req.body;
  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (role !== undefined && role !== user.role) {
    if (user.isSuperAdmin) {
      res.status(403);
      throw new Error("The system super admin's role cannot be changed.");
    }
    if (user._id.equals(req.user._id)) {
      res.status(403);
      throw new Error("You can't change your own role - ask another admin.");
    }
  }

  let access;
  try {
    access = await resolveAccess(user, req.body);
  } catch (err) {
    res.status(err.status || 400);
    throw err;
  }

  if (name !== undefined) user.name = name;
  user.role = access.role;
  user.managedDepartments = access.managedDepartments;
  user.leaveRecommendation = access.leaveRecommendation;
  if (isActive !== undefined) user.isActive = isActive;
  if (employee !== undefined) user.employee = employee || undefined;
  if (password) user.password = password;
  await user.save();
  res.json(await populateUser(User.findById(user._id)));
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = { getUsers, getDepartments, updateUser, deleteUser };
