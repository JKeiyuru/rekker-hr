// server/controllers/userController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().populate('employee', 'firstName lastName employeeId').sort({ createdAt: -1 });
  res.json(users);
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, role, isActive, employee, password } = req.body;
  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (employee !== undefined) user.employee = employee;
  if (password) user.password = password;
  await user.save();
  res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = { getUsers, updateUser, deleteUser };
