const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { geminiLimiter } = require('../middleware/rateLimiters');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const { MAX_FILE_BYTES } = require('../services/gemini/bulkPlan.service');

const geminiController = require('../controllers/gemini.controller');
const {
    saveConfigValidation,
    testConnectionValidation,
    savePexelsKeyValidation,
    testPexelsValidation,
    saveFallbacksValidation,
    generateBlogValidation,
    generateImageValidation,
    validateBulkRowsValidation,
    saveDraftValidation
} = require('../validators/gemini.validator');

const router = express.Router();

// Two pages meet in this file. The API key is a billing credential and belongs
// to the API Settings page; generating and saving drafts belongs to Gemini
// Blogs. Reading either page's state is a view — the key itself is never
// returned, only whether one is configured — and changing it is an edit.
const canReadConfig = [auth, viewPage('integrations')];
const canManageConfig = [auth, editPage('integrations')];
const canReadGemini = [auth, viewPage('geminiBlogs')];
const canGenerate = [auth, editPage('geminiBlogs')];

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
router.get('/config', canReadConfig, geminiController.getConfig);
router.put('/config', canManageConfig, saveConfigValidation, validate, geminiController.saveConfig);
router.delete('/config/key', canManageConfig, geminiController.removeKey);
router.post('/config/test', canManageConfig, geminiLimiter, testConnectionValidation, validate, geminiController.testConnection);
router.get('/config/fallbacks', canReadConfig, geminiController.getFallbacks);
router.put('/config/fallbacks', canManageConfig, saveFallbacksValidation, validate, geminiController.saveFallbacks);
router.delete('/config/fallbacks', canManageConfig, geminiController.clearFallbacks);

// Pexels (featured images): the same Super Admin rule as the Gemini key.
router.get('/pexels/config', canReadConfig, geminiController.getPexelsConfig);
router.put('/pexels/config', canManageConfig, savePexelsKeyValidation, validate, geminiController.savePexelsKey);
router.delete('/pexels/config/key', canManageConfig, geminiController.removePexelsKey);
router.post('/pexels/config/test', canManageConfig, geminiLimiter, testPexelsValidation, validate, geminiController.testPexelsConnection);

// ── Blog generation ───────────────────────────────────────────────────────────
router.get('/availability', canReadGemini, geminiController.getAvailability);
router.post('/blogs/generate', canGenerate, geminiLimiter, generateBlogValidation, validate, geminiController.generateBlog);
router.post('/blogs/image', canGenerate, geminiLimiter, generateImageValidation, validate, geminiController.generateImage);
router.post('/blogs/drafts', canGenerate, draftUpload, saveDraftValidation, validate, geminiController.saveDraft);

// ── Excel monthly plan ────────────────────────────────────────────────────────
// No Gemini calls, so not under the Gemini rate limit.
router.get('/blogs/bulk/template', canReadGemini, geminiController.bulkTemplate);
router.post('/blogs/bulk/parse', canGenerate, planUpload, geminiController.bulkParse);
router.post('/blogs/bulk/validate', canGenerate, validateBulkRowsValidation, validate, geminiController.bulkValidate);

module.exports = router;
