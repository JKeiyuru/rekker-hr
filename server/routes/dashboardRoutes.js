// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.get(
  '/',
  protect,
  authorize('admin', 'hr', 'director', 'manager', 'department_manager'),
  attachScope,
  getDashboardStats
);

module.exports = router;
