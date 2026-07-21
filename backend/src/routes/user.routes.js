const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/roles');

const userController = require('../controllers/user.controller');
const { createUserValidation, updateUserValidation } = require('../validators/user.validator');

const router = express.Router();

// Managing who can sign in — and with which role — is a super-admin power.
// Editors and content managers have no business here, so unlike every other
// module this one does not grant them read access either: the list exposes
// every colleague's email and role.
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

router.get('/', superAdminOnly, userController.listUsers);
router.get('/:id', superAdminOnly, userController.getUserById);
router.post('/', superAdminOnly, createUserValidation, validate, userController.createUser);
router.put('/:id', superAdminOnly, updateUserValidation, validate, userController.updateUser);
router.delete('/:id', superAdminOnly, userController.deleteUser);

module.exports = router;
