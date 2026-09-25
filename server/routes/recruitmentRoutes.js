// server/routes/recruitmentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getJobOpenings,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
  getApplicants,
  createApplicant,
  updateApplicant,
  deleteApplicant,
  convertApplicantToEmployee,
} = require('../controllers/recruitmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'hr', 'director', 'manager'));

router.get('/jobs', getJobOpenings);
router.post('/jobs', createJobOpening);
router.put('/jobs/:id', updateJobOpening);
router.delete('/jobs/:id', deleteJobOpening);

router.get('/applicants', getApplicants);
router.post('/applicants', createApplicant);
router.put('/applicants/:id', updateApplicant);
router.delete('/applicants/:id', deleteApplicant);
router.post('/applicants/:id/convert', authorize('admin', 'hr', 'director'), convertApplicantToEmployee);

module.exports = router;
