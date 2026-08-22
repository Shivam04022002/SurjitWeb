const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/roles');

const nodalController = require('../controllers/nodalOfficer.controller');
const {
    createOfficerValidation,
    updateOfficerValidation,
    reorderOfficersValidation
} = require('../validators/nodalOfficer.validator');

const router = express.Router();

// Permissions identical to Branches.
const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// reorder before /:id so the word is never read as an id
router.get('/', canRead, nodalController.listOfficers);
router.patch('/reorder', canManage, reorderOfficersValidation, validate, nodalController.reorderOfficers);
router.get('/:id', canRead, nodalController.getOfficerById);

router.post('/', canManage, createOfficerValidation, validate, nodalController.createOfficer);
router.put('/:id', canEdit, blockProtectedFields, updateOfficerValidation, validate, nodalController.updateOfficer);

router.delete('/:id', superAdminOnly, nodalController.deleteOfficer);
router.patch('/:id/publish', canManage, nodalController.publishOfficer);
router.patch('/:id/unpublish', canManage, nodalController.unpublishOfficer);

module.exports = router;
