const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');

const legalController = require('../controllers/legalPage.controller');
const {
    createPageValidation,
    updatePageValidation,
    reorderPagesValidation
} = require('../validators/legalPage.validator');

const router = express.Router();

const canManage = [auth, editPage('legalPages')];
const canRead = [auth, viewPage('legalPages')];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, editPage('legalPages')];
const superAdminOnly = [auth, editPage('legalPages')];

// One upload pass: the optional document must be a PDF. The filter requires the
// extension and reported mime type to agree, so a renamed file is rejected, as
// is any unexpected field. 25 MB ceiling matches the Reports module.
const pdfUpload = createUpload({
    folder: 'legal-pages',
    fileTypes: { pdf: 'pdf' },
    maxSize: 25 * 1024 * 1024
}).fields([{ name: 'pdf', maxCount: 1 }]);

// reorder before /:id so the word is never read as an id
router.get('/', canRead, legalController.listPages);
router.patch('/reorder', canManage, reorderPagesValidation, validate, legalController.reorderPages);
router.get('/:id', canRead, legalController.getPageById);

router.post('/', canManage, pdfUpload, createPageValidation, validate, legalController.createPage);
router.put('/:id', canEdit, blockProtectedFields, pdfUpload, updatePageValidation, validate, legalController.updatePage);

router.delete('/:id', superAdminOnly, legalController.deletePage);
router.patch('/:id/publish', canManage, legalController.publishPage);
router.patch('/:id/unpublish', canManage, legalController.unpublishPage);

module.exports = router;
