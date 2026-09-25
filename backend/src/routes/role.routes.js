const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { canView, canEdit } = require('../middleware/permission');
const roleController = require('../controllers/role.controller');
const {
    roleIdRule,
    createRoleValidation,
    updateRoleValidation
} = require('../validators/role.validator');

const router = express.Router();

// Roles are governed by the same catalogue they define: reading this page
// needs roles.view, and changing anything on it needs roles.edit.
const readRoles = [auth, canView('roles')];
const manageRoles = [auth, canEdit('roles')];

// What the signed-in admin may reach. Every authenticated admin may ask about
// itself — this is not a way into the roles page, it is what draws their own.
router.get('/me/permissions', auth, roleController.getMyPermissions);

// The page catalogue, for any authenticated admin.
//
// It is the list of pages this application has — their keys, labels, modules
// and admin paths — and nothing about any role: no permissions, no names, no
// holders. The CMS needs it to tell which page it is currently on, which is
// how a page decides whether to offer its Save button. Behind roles.view it
// left every ordinary role unable to resolve its own page, and therefore
// unable to edit anything it had been granted.
router.get('/catalogue', auth, roleController.getPermissionCatalogue);
router.get('/', readRoles, roleController.listRoles);
router.get('/:id', readRoles, roleIdRule, validate, roleController.getRoleById);

router.post('/', manageRoles, createRoleValidation, validate, roleController.createRole);
router.put('/:id', manageRoles, updateRoleValidation, validate, roleController.updateRole);

module.exports = router;
