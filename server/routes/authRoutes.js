// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', loginUser);
// Only an already-logged-in admin/HR user can create new accounts
router.post('/register', protect, authorize('admin', 'hr'), registerUser);
router.get('/me', protect, getMe);

module.exports = router;
