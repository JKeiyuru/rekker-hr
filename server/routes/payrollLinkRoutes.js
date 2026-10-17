// server/routes/payrollLinkRoutes.js
const express = require('express');
const router = express.Router();
const { audit, move } = require('../controllers/payrollLinkController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/', audit);
router.post('/move', move);

module.exports = router;
