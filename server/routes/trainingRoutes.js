// server/routes/trainingRoutes.js
const express = require('express');
const router = express.Router();
const {
  getTrainings,
  getTraining,
  createTraining,
  updateTraining,
  deleteTraining,
  getExpiringCertifications,
} = require('../controllers/trainingController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.use(protect, attachScope);

router.get('/', getTrainings);
router.get('/expiring-certs', getExpiringCertifications);
router.get('/:id', getTraining);
router.post('/', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), createTraining);
router.put('/:id', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), updateTraining);
router.delete('/:id', authorize('admin', 'hr'), deleteTraining);

module.exports = router;
