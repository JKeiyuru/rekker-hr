// server/routes/payslipRoutes.js
const express = require('express');
const router = express.Router();
const { mine, data, pdf } = require('../controllers/payslipController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/mine', mine);
router.get('/data', data);
router.get('/pdf', pdf);

module.exports = router;
