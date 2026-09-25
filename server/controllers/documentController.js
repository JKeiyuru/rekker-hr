// server/controllers/documentController.js
const asyncHandler = require('express-async-handler');
const Document = require('../models/Document');
const { scopeFilter, isWithinScope, resolveTargetEmployee } = require('../middleware/scope');

// Default list view: current documents only (an approved original, or a
// revision still awaiting review). 'Superseded' and 'Rejected' versions are
// history, not something you need cluttering the list - pass ?all=true to
// see everything, e.g. for an audit.
const getDocuments = asyncHandler(async (req, res) => {
  const { employee, category, all } = req.query;
  const filter = { ...scopeFilter(req.scope) };
  if (employee && isWithinScope(req.scope, employee)) filter.employee = employee;
  if (category) filter.category = category;
  if (!all) filter.status = { $in: ['Approved', 'Pending Review'] };

  const docs = await Document.find(filter)
    .populate('employee', 'firstName lastName employeeId')
    .populate('uploadedBy', 'name')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });
  res.json(docs);
});

// @desc    Upload a brand-new document (multipart/form-data, field "file")
// @route   POST /api/documents
const createDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('A file is required');
  }
  const employee = resolveTargetEmployee(req.scope, req.body.employee);
  if (!employee) {
    res.status(403);
    throw new Error("You don't have access to upload a document for this employee");
  }
  const doc = await Document.create({
    ...req.body,
    employee,
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    uploadedBy: req.user._id,
    status: 'Approved',
  });
  res.status(201).json(doc);
});

// @desc    Upload a replacement for an existing document.
//          - If the uploader has authority over that employee's records
//            (admin/hr/director/manager, or a department_manager over their
//            own department), the replacement is approved immediately.
//          - If the uploader is the employee themselves, the old document
//            stays as the current/approved one and the replacement sits as
//            'Pending Review' until someone with authority approves it.
// @route   POST /api/documents/:id/revise
const reviseDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('A file is required');
  }
  const original = await Document.findById(req.params.id);
  if (!original) {
    res.status(404);
    throw new Error('Document not found');
  }
  if (!isWithinScope(req.scope, original.employee)) {
    res.status(403);
    throw new Error("You don't have access to this document");
  }

  const isOwnDocument = req.scope.type === 'self';
  const revision = await Document.create({
    employee: original.employee,
    category: req.body.category || original.category,
    title: req.body.title || original.title,
    expiryDate: req.body.expiryDate || original.expiryDate,
    confidential: original.confidential,
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    uploadedBy: req.user._id,
    revisionOf: original._id,
    status: isOwnDocument ? 'Pending Review' : 'Approved',
    reviewedBy: isOwnDocument ? undefined : req.user._id,
    reviewedAt: isOwnDocument ? undefined : new Date(),
  });

  if (!isOwnDocument) {
    original.status = 'Superseded';
    await original.save();
  }

  res.status(201).json(revision);
});

// @desc    Approve a pending revision - the revision becomes the current
//          document, the one it replaces is marked superseded.
// @route   PUT /api/documents/:id/approve
const approveRevision = asyncHandler(async (req, res) => {
  const revision = await Document.findById(req.params.id);
  if (!revision || revision.status !== 'Pending Review') {
    res.status(404);
    throw new Error('Pending revision not found');
  }
  if (!isWithinScope(req.scope, revision.employee)) {
    res.status(403);
    throw new Error("You don't have access to this document");
  }
  revision.status = 'Approved';
  revision.reviewedBy = req.user._id;
  revision.reviewedAt = new Date();
  revision.reviewNotes = req.body.notes;
  await revision.save();

  if (revision.revisionOf) {
    await Document.findByIdAndUpdate(revision.revisionOf, { status: 'Superseded' });
  }
  res.json(revision);
});

// @desc    Reject a pending revision - the original document stays current.
// @route   PUT /api/documents/:id/reject
const rejectRevision = asyncHandler(async (req, res) => {
  const revision = await Document.findById(req.params.id);
  if (!revision || revision.status !== 'Pending Review') {
    res.status(404);
    throw new Error('Pending revision not found');
  }
  if (!isWithinScope(req.scope, revision.employee)) {
    res.status(403);
    throw new Error("You don't have access to this document");
  }
  revision.status = 'Rejected';
  revision.reviewedBy = req.user._id;
  revision.reviewedAt = new Date();
  revision.reviewNotes = req.body.notes;
  await revision.save();
  res.json(revision);
});

const updateDocument = asyncHandler(async (req, res) => {
  const existing = await Document.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Document not found');
  }
  if (!isWithinScope(req.scope, existing.employee)) {
    res.status(403);
    throw new Error("You don't have access to this document");
  }
  const doc = await Document.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json(doc);
});

// Deletion stays admin/hr only at the route level - nobody else can delete
// a document, including its own owner (they can only submit a revision).
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findByIdAndDelete(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Document not found');
  }
  res.json({ message: 'Deleted successfully' });
});

// @desc    Documents with an expiry date coming up within N days
// @route   GET /api/documents/expiring
const getExpiringDocuments = asyncHandler(async (req, res) => {
  const daysAhead = Number(req.query.days) || 60;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const docs = await Document.find({
    ...scopeFilter(req.scope),
    status: 'Approved',
    expiryDate: { $gte: new Date(), $lte: cutoff },
  }).populate('employee', 'firstName lastName employeeId');
  res.json(docs);
});

module.exports = {
  getDocuments,
  createDocument,
  reviseDocument,
  approveRevision,
  rejectRevision,
  updateDocument,
  deleteDocument,
  getExpiringDocuments,
};
