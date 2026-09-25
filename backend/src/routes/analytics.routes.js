const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');

const analyticsController = require('../controllers/analytics.controller');
const { overviewValidation, pagesValidation } = require('../validators/analytics.validator');

const router = express.Router();

// Traffic analytics is aggregate, read-only and contains no applicant or
// customer data, so it follows the same read band as the rest of the CMS.
// There is no write or delete endpoint here for any role — the only way data
// enters this collection is the anonymous public beacon.
const canReadAnalytics = [auth, viewPage('analytics')];

router.get('/overview', canReadAnalytics, overviewValidation, validate, analyticsController.getOverview);
router.get('/pages', canReadAnalytics, pagesValidation, validate, analyticsController.getPages);

module.exports = router;
