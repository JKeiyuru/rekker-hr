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
  listImportSheets,
  previewImport,
  commitImport,
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect, authorize('admin', 'hr', 'director'));

router.get('/', getPayrolls);
router.get('/export/:period', exportPayrollPeriod);

router.post('/import/sheets', upload.single('file'), listImportSheets);
router.post('/import/preview', upload.single('file'), previewImport);
router.post('/import/commit', commitImport);

router.get('/:id', getPayroll);
router.post('/', createPayroll);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

module.exports = router;
