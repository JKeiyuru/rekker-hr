// server/routes/assetRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAssets,
  createAsset,
  updateAsset,
  returnAsset,
  deleteAsset,
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');

router.use(protect, attachScope);

router.get('/', getAssets);
router.post('/', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), createAsset);
router.put('/:id', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), updateAsset);
router.put('/:id/return', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), returnAsset);
router.delete('/:id', authorize('admin', 'hr'), deleteAsset);

module.exports = router;
