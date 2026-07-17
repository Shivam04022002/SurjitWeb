const express = require('express');
const loanApplicationController = require('../controllers/loanApplication.controller');
const validate = require('../middleware/validate');
const { loanApplicationValidator } = require('../validators');
const { createUpload } = require('../middleware/upload');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const loanUploads = createUpload({ folder: 'loan-documents', fileTypes: 'all' }).fields([
    { name: 'aadhaarDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'bankStatementDoc', maxCount: 1 },
    { name: 'businessProofDoc', maxCount: 1 }
]);

router.post('/', loanUploads, loanApplicationValidator.loanValidation, validate, loanApplicationController.submitLoanApplication);
router.get('/status/:applicationNumber', loanApplicationController.getApplicationStatus);
router.get('/', auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER), loanApplicationController.getAllApplications);

module.exports = router;
