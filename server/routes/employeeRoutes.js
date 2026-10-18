// server/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeePay,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeOptions,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');
const { PAYROLL_VIEW_ROLES } = require('../config/roles');

router.use(protect);

router.get('/meta/options', getEmployeeOptions);
router.get('/', attachScope, getEmployees);
router.get('/:id/pay', authorize(...PAYROLL_VIEW_ROLES), getEmployeePay);
router.get('/:id', attachScope, getEmployee);
router.post('/', authorize('admin', 'hr'), createEmployee);
router.put('/:id', authorize('admin', 'hr'), updateEmployee);
router.delete('/:id', authorize('admin', 'hr'), deleteEmployee);

module.exports = router;
