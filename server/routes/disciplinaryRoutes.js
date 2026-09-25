// server/routes/disciplinaryRoutes.js
const express = require('express');
const router = express.Router();
const {
  getCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
} = require('../controllers/disciplinaryController');
const { protect, authorize } = require('../middleware/auth');

// Confidential HR records - admin & HR only, nobody else.
router.use(protect, authorize('admin', 'hr'));

router.get('/', getCases);
router.get('/:id', getCase);
router.post('/', createCase);
router.put('/:id', updateCase);
router.delete('/:id', deleteCase);

module.exports = router;
