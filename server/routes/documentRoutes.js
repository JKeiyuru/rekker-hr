// server/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDocuments,
  createDocument,
  reviseDocument,
  approveRevision,
  rejectRevision,
  updateDocument,
  deleteDocument,
  getExpiringDocuments,
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { attachScope } = require('../middleware/scope');
const upload = require('../middleware/upload');

router.use(protect, attachScope);

router.get('/', getDocuments);
router.get('/expiring', getExpiringDocuments);
// Everyone can upload - for themselves. Company-wide/department roles can
// upload on behalf of someone within their scope; the controller enforces
// exactly who via resolveTargetEmployee().
router.post('/', upload.single('file'), createDocument);
router.post('/:id/revise', upload.single('file'), reviseDocument);
router.put('/:id/approve', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), approveRevision);
router.put('/:id/reject', authorize('admin', 'hr', 'director', 'manager', 'department_manager'), rejectRevision);
router.put('/:id', authorize('admin', 'hr'), updateDocument);
// Nobody but admin/hr can delete a document - not even its own owner.
router.delete('/:id', authorize('admin', 'hr'), deleteDocument);

module.exports = router;
