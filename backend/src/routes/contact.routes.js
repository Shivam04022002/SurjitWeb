const express = require('express');
const contactController = require('../controllers/contact.controller');
const validate = require('../middleware/validate');
const { contactValidator } = require('../validators');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');

const router = express.Router();

router.post('/', contactValidator.contactValidation, validate, contactController.submitContact);
router.get('/', auth, viewPage('contacts'), contactController.getAllContacts);

module.exports = router;
