// server/routes/payrollRoutes.js
const express = require('express');
const router = express.Router();
const {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  deletePayroll,
  exportPayrollPeriod,
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'hr', 'director'));

router.get('/', getPayrolls);
router.get('/export/:period', exportPayrollPeriod);
router.get('/:id', getPayroll);
router.post('/', createPayroll);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

module.exports = router;
