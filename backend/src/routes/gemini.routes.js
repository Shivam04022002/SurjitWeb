const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { geminiLimiter } = require('../middleware/rateLimiters');
const { ROLES } = require('../constants/roles');

const geminiController = require('../controllers/gemini.controller');
const {
    saveConfigValidation,
    testConnectionValidation,
    generateBlogValidation,
    generateImageValidation,
    planMonthValidation,
    saveDraftValidation
} = require('../validators/gemini.validator');

const router = express.Router();

// The API key is a billing credential, so its configuration is Super Admin
// only. Generating and saving drafts creates blog records, which follows the
// blog module's create band: Super Admin and Editor. Content Manager cannot
// create blogs anywhere, and cannot here.
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];
const canGenerate = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];

// Same storage path and file rules as the blog editor's own upload.
const draftUpload = createUpload({ folder: 'blog', fileTypes: 'images' }).fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'seo.ogImage', maxCount: 1 },
    { name: 'ogImage', maxCount: 1 }
]);

// ── API configuration ─────────────────────────────────────────────────────────
router.get('/config', superAdminOnly, geminiController.getConfig);
router.put('/config', superAdminOnly, saveConfigValidation, validate, geminiController.saveConfig);
router.delete('/config/key', superAdminOnly, geminiController.removeKey);
router.post('/config/test', superAdminOnly, geminiLimiter, testConnectionValidation, validate, geminiController.testConnection);

// ── Blog generation ───────────────────────────────────────────────────────────
router.get('/availability', canGenerate, geminiController.getAvailability);
router.post('/blogs/generate', canGenerate, geminiLimiter, generateBlogValidation, validate, geminiController.generateBlog);
router.post('/blogs/image', canGenerate, geminiLimiter, generateImageValidation, validate, geminiController.generateImage);
router.post('/blogs/plan', canGenerate, geminiLimiter, planMonthValidation, validate, geminiController.planMonth);
router.post('/blogs/drafts', canGenerate, draftUpload, saveDraftValidation, validate, geminiController.saveDraft);

module.exports = router;
