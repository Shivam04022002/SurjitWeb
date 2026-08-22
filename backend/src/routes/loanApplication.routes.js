const express = require('express');
const loanApplicationController = require('../controllers/loanApplication.controller');
const validate = require('../middleware/validate');
const { loanApplicationValidator } = require('../validators');
const { createUpload } = require('../middleware/upload');
const { loanApplicationLimiter, loanStatusLimiter } = require('../middleware/rateLimiters');
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

// Loan applications hold PAN, Aadhaar, date of birth and full address. That is
// materially more sensitive than the marketing content the CMS otherwise
// manages, so unlike every other module here the read grant stops at Editor
// and does not extend to Content Manager.
const canViewApplications = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
// Moving an application between statuses is limited to the same two roles that
// may see it at all — Content Manager reaches neither.
const canDecideApplications = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];

// ── Public ───────────────────────────────────────────────────────────────────

router.post(
    '/',
    loanApplicationLimiter,
    loanUploads,
    loanApplicationValidator.loanValidation,
    validate,
    loanApplicationController.submitLoanApplication
);

router.get('/status/:applicationNumber', loanStatusLimiter, loanApplicationController.getApplicationStatus);

// ── Admin ────────────────────────────────────────────────────────────────────
// Paginated and filtered; the list withholds PAN, Aadhaar, DOB and address,
// which are returned only by the detail route below.

router.get('/', canViewApplications, loanApplicationController.getAllApplications);
router.get('/:id', canViewApplications, loanApplicationController.getApplicationById);

// Status decision. Only `status` is read from the body; every other applicant
// field is untouchable through this route.
router.patch(
    '/:id/status',
    canDecideApplications,
    loanApplicationValidator.updateStatusValidation,
    validate,
    loanApplicationController.updateApplicationStatus
);

module.exports = router;
