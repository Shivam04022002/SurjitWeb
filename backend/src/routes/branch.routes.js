const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/roles');

const branchController = require('../controllers/branch.controller');
const {
    createBranchValidation,
    updateBranchValidation,
    reorderBranchesValidation
} = require('../validators/branch.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// reorder before /:id so the word is never read as an id
router.get('/', canRead, branchController.listBranches);
router.patch('/reorder', canManage, reorderBranchesValidation, validate, branchController.reorderBranches);
router.get('/:id', canRead, branchController.getBranchById);

router.post('/', canManage, createBranchValidation, validate, branchController.createBranch);
router.put('/:id', canManage, updateBranchValidation, validate, branchController.updateBranch);

router.delete('/:id', superAdminOnly, branchController.deleteBranch);
router.patch('/:id/publish', canManage, branchController.publishBranch);
router.patch('/:id/unpublish', canManage, branchController.unpublishBranch);

module.exports = router;
