const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { geminiLimiter } = require('../middleware/rateLimiters');
const { ROLES } = require('../constants/roles');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const { MAX_FILE_BYTES } = require('../services/gemini/bulkPlan.service');

const geminiController = require('../controllers/gemini.controller');
const {
    saveConfigValidation,
    testConnectionValidation,
    generateBlogValidation,
    generateImageValidation,
    validateBulkRowsValidation,
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

// Monthly plan workbooks: held in memory only (never written to disk or S3),
// one file, size-capped. The extension check here is a first filter; the
// service also checks the file's signature before reading it.
const planUpload = (req, res, next) => multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 5 },
    fileFilter: (r, file, cb) => (/\.(xlsx|xls)$/i.test(file.originalname)
        ? cb(null, true)
        : cb(new AppError('Upload an Excel file (.xlsx or .xls).', HTTP_STATUS.BAD_REQUEST)))
}).single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(`The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`, HTTP_STATUS.BAD_REQUEST));
    return next(new AppError('The upload could not be read. Upload one Excel file in the "file" field.', HTTP_STATUS.BAD_REQUEST));
});

// ── API configuration ─────────────────────────────────────────────────────────
router.get('/config', superAdminOnly, geminiController.getConfig);
router.put('/config', superAdminOnly, saveConfigValidation, validate, geminiController.saveConfig);
router.delete('/config/key', superAdminOnly, geminiController.removeKey);
router.post('/config/test', superAdminOnly, geminiLimiter, testConnectionValidation, validate, geminiController.testConnection);

// ── Blog generation ───────────────────────────────────────────────────────────
router.get('/availability', canGenerate, geminiController.getAvailability);
router.post('/blogs/generate', canGenerate, geminiLimiter, generateBlogValidation, validate, geminiController.generateBlog);
router.post('/blogs/image', canGenerate, geminiLimiter, generateImageValidation, validate, geminiController.generateImage);
router.post('/blogs/drafts', canGenerate, draftUpload, saveDraftValidation, validate, geminiController.saveDraft);

// ── Excel monthly plan ────────────────────────────────────────────────────────
// No Gemini calls, so not under the Gemini rate limit.
router.get('/blogs/bulk/template', canGenerate, geminiController.bulkTemplate);
router.post('/blogs/bulk/parse', canGenerate, planUpload, geminiController.bulkParse);
router.post('/blogs/bulk/validate', canGenerate, validateBulkRowsValidation, validate, geminiController.bulkValidate);

module.exports = router;
