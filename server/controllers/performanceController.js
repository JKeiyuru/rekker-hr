// server/controllers/performanceController.js
const asyncHandler = require('express-async-handler');
const Performance = require('../models/Performance');
const { scopeFilter, isWithinScope } = require('../middleware/scope');

const getReviews = asyncHandler(async (req, res) => {
  const { employee, period, status } = req.query;
  const filter = { ...scopeFilter(req.scope) };
  if (employee && isWithinScope(req.scope, employee)) filter.employee = employee;
  if (period) filter.period = period;
  if (status) filter.status = status;
  const reviews = await Performance.find(filter)
    .populate('employee', 'firstName lastName employeeId department role photoUrl')
    .populate('reviewer', 'firstName lastName')
    .sort({ createdAt: -1 });
  res.json(reviews);
});

const getReview = asyncHandler(async (req, res) => {
  const review = await Performance.findById(req.params.id)
    .populate('employee')
    .populate('reviewer', 'firstName lastName');
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (!isWithinScope(req.scope, review.employee._id)) {
    res.status(403);
    throw new Error("You don't have access to this review");
  }
  res.json(review);
});

const createReview = asyncHandler(async (req, res) => {
  if (!isWithinScope(req.scope, req.body.employee)) {
    res.status(403);
    throw new Error('You can only create reviews for employees in your own department');
  }
  const review = await Performance.create(req.body);
  res.status(201).json(review);
});

const updateReview = asyncHandler(async (req, res) => {
  const review = await Performance.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (!isWithinScope(req.scope, review.employee)) {
    res.status(403);
    throw new Error("You don't have access to this review");
  }
  Object.assign(review, req.body);
  await review.save(); // triggers achievement % recalculation
  res.json(review);
});

const deleteReview = asyncHandler(async (req, res) => {
  const review = await Performance.findByIdAndDelete(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = { getReviews, getReview, createReview, updateReview, deleteReview };
