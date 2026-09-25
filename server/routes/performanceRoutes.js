// server/routes/performanceRoutes.js
const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/performanceController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.use(protect, attachScope);

router.get('/', getReviews);
router.get('/:id', getReview);
router.post('/', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), createReview);
router.put('/:id', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), updateReview);
router.delete('/:id', authorize('admin', 'hr'), deleteReview);

module.exports = router;
