// server/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAttendance,
  checkIn,
  checkOut,
  upsertAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceSummary,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.use(protect, attachScope);

router.get('/', getAttendance);
router.get('/summary', getAttendanceSummary);
router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), upsertAttendance);
router.put('/:id', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), updateAttendance);
router.delete('/:id', authorize('admin', 'hr'), deleteAttendance);

module.exports = router;
