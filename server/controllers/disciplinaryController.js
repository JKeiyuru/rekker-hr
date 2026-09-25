// server/controllers/disciplinaryController.js
const asyncHandler = require('express-async-handler');
const DisciplinaryCase = require('../models/DisciplinaryCase');

// NOTE: routes for this controller are restricted to 'admin' and 'hr' roles
// at the router level (see routes/disciplinaryRoutes.js) since these are
// confidential HR records.

const getCases = asyncHandler(async (req, res) => {
  const { status, employee, category } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  if (category) filter.category = category;
  const cases = await DisciplinaryCase.find(filter)
    .populate('employee', 'firstName lastName employeeId department')
    .populate('raisedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
  res.json(cases);
});

const getCase = asyncHandler(async (req, res) => {
  const item = await DisciplinaryCase.findById(req.params.id)
    .populate('employee', 'firstName lastName employeeId department')
    .populate('raisedBy', 'firstName lastName');
  if (!item) {
    res.status(404);
    throw new Error('Case not found');
  }
  res.json(item);
});

const createCase = asyncHandler(async (req, res) => {
  const item = await DisciplinaryCase.create(req.body);
  res.status(201).json(item);
});

const updateCase = asyncHandler(async (req, res) => {
  const item = await DisciplinaryCase.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) {
    res.status(404);
    throw new Error('Case not found');
  }
  res.json(item);
});

const deleteCase = asyncHandler(async (req, res) => {
  const item = await DisciplinaryCase.findByIdAndDelete(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Case not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = { getCases, getCase, createCase, updateCase, deleteCase };
