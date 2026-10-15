// server/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

// Any logged-in user, but always and only their own linked employee record.
router.use(protect);
router.get('/', getProfile);
router.put('/', updateProfile);

module.exports = router;
