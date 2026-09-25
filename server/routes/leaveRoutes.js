// server/routes/leaveRoutes.js
const express = require('express');
const router = express.Router();
const {
  getLeaves,
  applyLeave,
  sectionHeadReview,
  decideLeave,
  cancelLeave,
  deleteLeave,
  getLeaveBalances,
  updateLeaveBalance,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.use(protect, attachScope);

router.get('/balances', getLeaveBalances);
router.put('/balances/:id', authorize('admin', 'hr'), updateLeaveBalance);

router.get('/', getLeaves);
router.post('/', applyLeave);
// Part B: a section head (department manager) or anyone above them can
// leave a recommendation - it's advisory and doesn't decide the outcome.
router.put(
  '/:id/section-head-review',
  authorize('admin', 'hr', 'director', 'manager', 'department_manager'),
  sectionHeadReview
);
// Part C: the FINAL decision. Deliberately excludes department_manager -
// per Rekker's paper form, that's Management's call, not the section
// head's.
router.put('/:id/decision', authorize('admin', 'hr', 'director', 'manager'), decideLeave);
router.put('/:id/cancel', cancelLeave);
router.delete('/:id', authorize('admin', 'hr'), deleteLeave);

module.exports = router;
