// server/controllers/assetController.js
const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const { scopeFilter, isWithinScope } = require('../middleware/scope');

const getAssets = asyncHandler(async (req, res) => {
  const { status, category, assignedTo } = req.query;
  const filter = { ...scopeFilter(req.scope, 'assignedTo') };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (assignedTo && isWithinScope(req.scope, assignedTo)) filter.assignedTo = assignedTo;
  const assets = await Asset.find(filter)
    .populate('assignedTo', 'firstName lastName employeeId department')
    .sort({ createdAt: -1 });
  res.json(assets);
});

const createAsset = asyncHandler(async (req, res) => {
  if (req.body.assignedTo && !isWithinScope(req.scope, req.body.assignedTo)) {
    res.status(403);
    throw new Error('You can only issue assets to employees in your own department');
  }
  const asset = await Asset.create(req.body);
  res.status(201).json(asset);
});

const updateAsset = asyncHandler(async (req, res) => {
  const existing = await Asset.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Asset not found');
  }
  if (existing.assignedTo && !isWithinScope(req.scope, existing.assignedTo)) {
    res.status(403);
    throw new Error("You don't have access to this asset");
  }
  const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json(asset);
});

// @desc    Process an asset return with the return checklist
// @route   PUT /api/assets/:id/return
const returnAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  if (asset.assignedTo && !isWithinScope(req.scope, asset.assignedTo)) {
    res.status(403);
    throw new Error("You don't have access to this asset");
  }
  asset.returnChecklist = { ...asset.returnChecklist.toObject(), ...req.body.returnChecklist };
  const allChecked = Object.values(asset.returnChecklist.toObject()).every(Boolean);
  if (allChecked) {
    asset.status = 'Returned';
    asset.returnDate = new Date();
    asset.assignedTo = null;
  }
  await asset.save();
  res.json(asset);
});

const deleteAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findByIdAndDelete(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  res.json({ message: 'Deleted successfully' });
});

module.exports = { getAssets, createAsset, updateAsset, returnAsset, deleteAsset };
