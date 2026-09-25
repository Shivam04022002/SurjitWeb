const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');

const statController = require('../controllers/homepageStat.controller');
const {
    createStatValidation,
    updateStatValidation,
    reorderStatsValidation
} = require('../validators/homepageStat.validator');

const router = express.Router();

const canManage = [auth, editPage('homepageStats')];
const canRead = [auth, viewPage('homepageStats')];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, editPage('homepageStats')];
const superAdminOnly = [auth, editPage('homepageStats')];

// reorder before /:id so the word is never read as an id
router.get('/', canRead, statController.listStats);
router.patch('/reorder', canManage, reorderStatsValidation, validate, statController.reorderStats);
router.get('/:id', canRead, statController.getStatById);

router.post('/', canManage, createStatValidation, validate, statController.createStat);
router.put('/:id', canEdit, blockProtectedFields, updateStatValidation, validate, statController.updateStat);

router.delete('/:id', superAdminOnly, statController.deleteStat);
router.patch('/:id/publish', canManage, statController.publishStat);
router.patch('/:id/unpublish', canManage, statController.unpublishStat);

module.exports = router;
