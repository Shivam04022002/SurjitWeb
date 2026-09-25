const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');

const userController = require('../controllers/user.controller');
const { createUserValidation, updateUserValidation } = require('../validators/user.validator');

const router = express.Router();

// Who can sign in, and with which role. The list exposes every colleague's
// email and role, so it is not granted casually — but reading it is a view and
// creating or changing an account is an edit, like every other page.
const canRead = [auth, viewPage('users')];
const canManage = [auth, editPage('users')];

router.get('/', canRead, userController.listUsers);
router.get('/:id', canRead, userController.getUserById);
router.post('/', canManage, createUserValidation, validate, userController.createUser);
router.put('/:id', canManage, updateUserValidation, validate, userController.updateUser);
router.delete('/:id', canManage, userController.deleteUser);

module.exports = router;
