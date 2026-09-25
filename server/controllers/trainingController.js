// server/controllers/trainingController.js
const asyncHandler = require('express-async-handler');
const Training = require('../models/Training');
const { scopeFilter, isWithinScope } = require('../middleware/scope');

const attendeeScopeFilter = (scope) => {
  if (scope.type === 'all') return {};
  if (scope.type === 'department') return { 'attendees.employee': { $in: scope.employeeIds } };
  return { 'attendees.employee': scope.employeeId };
};

const getTrainings = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { ...attendeeScopeFilter(req.scope) };
  if (status) filter.status = status;
  const trainings = await Training.find(filter)
    .populate('attendees.employee', 'firstName lastName employeeId department')
    .sort({ startDate: -1 });
  res.json(trainings);
});

const getTraining = asyncHandler(async (req, res) => {
  const training = await Training.findById(req.params.id).populate(
    'attendees.employee',
    'firstName lastName employeeId department'
  );
  if (!training) {
    res.status(404);
    throw new Error('Training program not found');
  }
  if (req.scope.type !== 'all' && !training.attendees.some((a) => isWithinScope(req.scope, a.employee))) {
    res.status(403);
    throw new Error("You don't have access to this training program");
  }
  res.json(training);
});

const createTraining = asyncHandler(async (req, res) => {
  const outOfScope = (req.body.attendees || []).some((a) => !isWithinScope(req.scope, a.employee));
  if (outOfScope) {
    res.status(403);
    throw new Error('You can only enrol employees from your own department');
  }
  const training = await Training.create(req.body);
  res.status(201).json(training);
});

const updateTraining = asyncHandler(async (req, res) => {
  if (req.body.attendees) {
    const outOfScope = req.body.attendees.some((a) => !isWithinScope(req.scope, a.employee));
    if (outOfScope) {
      res.status(403);
      throw new Error('You can only enrol employees from your own department');
    }
  }
  const training = await Training.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!training) {
    res.status(404);
    throw new Error('Training program not found');
  }
  res.json(training);
});

const deleteTraining = asyncHandler(async (req, res) => {
  const training = await Training.findByIdAndDelete(req.params.id);
  if (!training) {
    res.status(404);
    throw new Error('Training program not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Records expiring certifications across all trainings
// @route   GET /api/training/expiring-certs
const getExpiringCertifications = asyncHandler(async (req, res) => {
  const daysAhead = Number(req.query.days) || 60;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const trainings = await Training.find({
    ...attendeeScopeFilter(req.scope),
    'attendees.certificateExpiry': { $lte: cutoff, $gte: new Date() },
  }).populate('attendees.employee', 'firstName lastName employeeId');

  const expiring = [];
  trainings.forEach((t) => {
    t.attendees.forEach((a) => {
      if (
        a.certificateExpiry &&
        a.certificateExpiry <= cutoff &&
        a.certificateExpiry >= new Date() &&
        isWithinScope(req.scope, a.employee)
      ) {
        expiring.push({
          training: t.title,
          employee: a.employee,
          certificateExpiry: a.certificateExpiry,
        });
      }
    });
  });

  res.json(expiring);
});

module.exports = {
  getTrainings,
  getTraining,
  createTraining,
  updateTraining,
  deleteTraining,
  getExpiringCertifications,
};
