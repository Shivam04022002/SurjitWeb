const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');

const branchController = require('../controllers/branch.controller');
const {
    createBranchValidation,
    updateBranchValidation,
    reorderBranchesValidation
} = require('../validators/branch.validator');

const router = express.Router();

const canManage = [auth, editPage('branches')];
const canRead = [auth, viewPage('branches')];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, editPage('branches')];
const superAdminOnly = [auth, editPage('branches')];

// reorder before /:id so the word is never read as an id
router.get('/', canRead, branchController.listBranches);
router.patch('/reorder', canManage, reorderBranchesValidation, validate, branchController.reorderBranches);
router.get('/:id', canRead, branchController.getBranchById);

router.post('/', canManage, createBranchValidation, validate, branchController.createBranch);
router.put('/:id', canEdit, blockProtectedFields, updateBranchValidation, validate, branchController.updateBranch);

router.delete('/:id', superAdminOnly, branchController.deleteBranch);
router.patch('/:id/publish', canManage, branchController.publishBranch);
router.patch('/:id/unpublish', canManage, branchController.unpublishBranch);

module.exports = router;
