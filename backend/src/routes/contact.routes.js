const express = require('express');
const contactController = require('../controllers/contact.controller');
const validate = require('../middleware/validate');
const { contactValidator } = require('../validators');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.post('/', contactValidator.contactValidation, validate, contactController.submitContact);
router.get('/', auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER), contactController.getAllContacts);

module.exports = router;
