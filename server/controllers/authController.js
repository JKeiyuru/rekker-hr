// server/controllers/authController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user (admin/HR only in practice)
// @route   POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, employee } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('A user with that email already exists');
  }

  const user = await User.create({ name, email, password, role, employee });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
});

// @desc    Login user & get token
// @route   POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+password')
    .populate('employee');

  // Guard against a user record with no password hash at all (e.g. created
  // by hand directly in the database rather than through this API/the seed
  // scripts) - without this, bcrypt throws on undefined and you get an
  // opaque 500 instead of a clear "invalid credentials".
  const passwordMatches = user && user.password ? await user.matchPassword(password) : false;

  if (!user || !passwordMatches) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact HR.');
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employee: user.employee,
    token: generateToken(user._id),
  });
});

// @desc    Get current logged-in user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('employee');
  res.json(user);
});

module.exports = { registerUser, loginUser, getMe };
