// server/routes/payrollRoutes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { PAYROLL_MANAGE_ROLES, PAYROLL_APPROVE_ROLES, PAYROLL_VIEW_ROLES } = require('../config/roles');

router.use(protect);
const view = authorize(...PAYROLL_VIEW_ROLES);
const manage = authorize(...PAYROLL_MANAGE_ROLES);
const approve = authorize(...PAYROLL_APPROVE_ROLES);

router.get('/meta', view, c.getMeta);

// templates
router.get('/template/:runType', view, c.getTemplate);
router.put('/template/:runType', manage, c.saveTemplate);

// runs
router.get('/runs', view, c.listRuns);
router.post('/runs', manage, c.createRun);
router.get('/runs/:period/:runType', view, c.getRun);
router.put('/runs/:period/:runType/status', approve, c.setStatus);
router.post('/runs/:period/:runType/recalculate', manage, c.recalc);
router.post('/runs/:period/:runType/entries', manage, c.addEntry);
router.delete('/runs/:period/:runType', manage, c.deleteRun);

// rows
router.patch('/entries/bulk', manage, c.patchMany);
router.patch('/entries/:id', manage, c.patchEntry);
router.delete('/entries/:id', manage, c.removeEntry);

// staff picker + quick add (people on payroll without a login)
router.get('/staff', view, c.listStaff);
router.post('/staff', manage, c.createStaff);

// Excel in
router.post('/import/sheets', manage, upload.single('file'), c.importSheets);
router.post('/import/preview', manage, upload.single('file'), c.importPreview);
router.post('/import/auto', manage, upload.single('file'), c.importAuto);
router.post('/import/commit', manage, c.importCommit);

// Excel out + reports
router.get('/export/:period/:runType', view, c.exportRun);
router.get('/bank/:period/:runType', view, c.exportBank);
router.get('/summary', view, c.summary);
router.get('/summary/export', view, c.exportSummary);
router.get('/audit', view, c.getAudit);

module.exports = router;
