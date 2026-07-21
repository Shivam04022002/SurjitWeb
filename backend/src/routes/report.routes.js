const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

const reportController = require('../controllers/report.controller');
const {
    createReportValidation,
    updateReportValidation,
    reorderReportsValidation
} = require('../validators/report.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// One upload pass, validated per field: the report itself must be a PDF, the
// optional thumbnail must be an image. 25 MB ceiling covers the PDF; the filter
// requires each file's extension and reported mime type to agree, so a renamed
// executable is rejected on both counts and an unlisted field is rejected too.
const reportUpload = createUpload({
    folder: 'reports',
    fileTypes: { pdf: 'pdf', thumbnail: 'images' },
    maxSize: 25 * 1024 * 1024
}).fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

// reorder before /:id so the word is never read as an id
router.get('/', canRead, reportController.listReports);
router.patch('/reorder', canManage, reorderReportsValidation, validate, reportController.reorderReports);
router.get('/:id', canRead, reportController.getReportById);

router.post('/', canManage, reportUpload, createReportValidation, validate, reportController.createReport);
router.put('/:id', canManage, reportUpload, updateReportValidation, validate, reportController.updateReport);

router.delete('/:id', superAdminOnly, reportController.deleteReport);
router.patch('/:id/publish', canManage, reportController.publishReport);
router.patch('/:id/unpublish', canManage, reportController.unpublishReport);

module.exports = router;
