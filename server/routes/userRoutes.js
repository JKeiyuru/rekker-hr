// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { registerUser } = require('../controllers/authController');

router.use(protect, authorize('admin'));

router.get('/', getUsers);
router.post('/', registerUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
