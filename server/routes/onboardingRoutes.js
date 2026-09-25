// server/routes/onboardingRoutes.js
const express = require('express');
const router = express.Router();
const {
  getOnboardings,
  getOnboarding,
  createOnboarding,
  updateChecklist,
  updateOnboarding,
  deleteOnboarding,
} = require('../controllers/onboardingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'hr', 'director', 'manager'));

router.get('/', getOnboardings);
router.get('/:id', getOnboarding);
router.post('/', createOnboarding);
router.put('/:id/checklist', updateChecklist);
router.put('/:id', updateOnboarding);
router.delete('/:id', authorize('admin', 'hr'), deleteOnboarding);

module.exports = router;
