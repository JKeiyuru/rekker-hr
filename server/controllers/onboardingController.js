// server/controllers/onboardingController.js
const asyncHandler = require('express-async-handler');
const Onboarding = require('../models/Onboarding');

const getOnboardings = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const records = await Onboarding.find(filter)
    .populate('employee', 'firstName lastName employeeId department role photoUrl dateJoined')
    .sort({ createdAt: -1 });
  res.json(records);
});

const getOnboarding = asyncHandler(async (req, res) => {
  const record = await Onboarding.findById(req.params.id).populate('employee');
  if (!record) {
    res.status(404);
    throw new Error('Onboarding record not found');
  }
  res.json(record);
});

const createOnboarding = asyncHandler(async (req, res) => {
  const record = await Onboarding.create(req.body);
  res.status(201).json(record);
});

// @desc    Update checklist items (partial update, merges with existing checklist)
// @route   PUT /api/onboarding/:id/checklist
const updateChecklist = asyncHandler(async (req, res) => {
  const record = await Onboarding.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Onboarding record not found');
  }
  record.checklist = { ...record.checklist.toObject(), ...req.body };
  await record.save();
  res.json(record);
});

const updateOnboarding = asyncHandler(async (req, res) => {
  const record = await Onboarding.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!record) {
    res.status(404);
    throw new Error('Onboarding record not found');
  }
  res.json(record);
});

const deleteOnboarding = asyncHandler(async (req, res) => {
  const record = await Onboarding.findByIdAndDelete(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Onboarding record not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = {
  getOnboardings,
  getOnboarding,
  createOnboarding,
  updateChecklist,
  updateOnboarding,
  deleteOnboarding,
};
