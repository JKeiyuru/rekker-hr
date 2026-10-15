// server/routes/leaveRoutes.js
const express = require('express');
const router = express.Router();
const {
  getLeaves,
  getLeavesToRecommend,
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
const { RECOMMENDER_ROLES, LEAVE_DECISION_ROLES } = require('../config/roles');

router.use(protect, attachScope);

router.get('/balances', getLeaveBalances);
router.put('/balances/:id', authorize('admin', 'hr'), updateLeaveBalance);

router.get('/', getLeaves);
router.post('/', applyLeave);
// Part B: recommend / not recommend. Advisory only. Open to anyone with the
// recommender roles; the controller then checks the admin has switched it on
// for them and that the employee is in one of their departments.
router.get('/to-recommend', authorize(...RECOMMENDER_ROLES), getLeavesToRecommend);
router.put('/:id/section-head-review', authorize(...RECOMMENDER_ROLES), sectionHeadReview);
// Part C: the FINAL decision - admin, HR or director only (can approve
// applications that were marked Not Recommended too).
router.put('/:id/decision', authorize(...LEAVE_DECISION_ROLES), decideLeave);
router.put('/:id/cancel', cancelLeave);
router.delete('/:id', authorize('admin', 'hr'), deleteLeave);

module.exports = router;
