const geminiConfig = require('../services/gemini/geminiConfig.service');
const geminiBlog = require('../services/gemini/geminiBlog.service');
const pexelsConfig = require('../services/images/pexelsConfig.service');
const bulkPlan = require('../services/gemini/bulkPlan.service');
const { normaliseBody, collectFiles } = require('./blog/blogs.controller');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('../services/upload.service');
const { isUsableImageModel } = require('../services/gemini/imageModels');

// ── API configuration (Super Admin) ────────────────────────────────────────────
// Every response here is built by geminiConfig.publicStatus(), which carries
// the key's last four characters at most — never the key or its ciphertext.

const getConfig = asyncHandler(async (req, res) => {
    const config = await geminiConfig.publicStatus();
    return sendSuccess(res, 'Gemini configuration fetched', { config });
});

const saveConfig = asyncHandler(async (req, res) => {
    const config = await geminiConfig.saveConfig({
        apiKey: req.body.apiKey || undefined,
        textModel: req.body.textModel,
        imageModel: req.body.imageModel,
        imageGenerationEnabled: req.body.imageGenerationEnabled,
        pexelsFallbackEnabled: req.body.pexelsFallbackEnabled
    }, req.user._id);
    return sendSuccess(res, 'Gemini configuration saved', { config });
});

const removeKey = asyncHandler(async (req, res) => {
    const config = await geminiConfig.removeKey(req.user._id);
    return sendSuccess(res, 'Gemini API key removed', { config });
});

const testConnection = asyncHandler(async (req, res) => {
    const result = await geminiConfig.testConnection({ apiKey: req.body.apiKey || undefined });
    return sendSuccess(res, result.ok ? 'Connection successful' : 'Connection failed', { result });
});

// Free fallback text models. Responses carry model names only.
const getFallbacks = asyncHandler(async (req, res) => {
    const fallbacks = await geminiConfig.fallbackStatus();
    return sendSuccess(res, 'Gemini fallback models fetched', { fallbacks });
});

const saveFallbacks = asyncHandler(async (req, res) => {
    const fallbacks = await geminiConfig.saveFallbacks(req.body.models, req.user._id);
    return sendSuccess(res, 'Gemini fallback models saved', { fallbacks });
});

const clearFallbacks = asyncHandler(async (req, res) => {
    const fallbacks = await geminiConfig.clearFallbacks(req.user._id);
    return sendSuccess(res, 'Gemini fallback models cleared', { fallbacks });
});

// ── Pexels API configuration (Super Admin) ────────────────────────────────────
// Same pattern as Gemini: responses come from pexelsConfig.publicStatus(),
// which carries the key's last four characters at most.

const getPexelsConfig = asyncHandler(async (req, res) => {
    const config = await pexelsConfig.publicStatus();
    return sendSuccess(res, 'Pexels configuration fetched', { config });
});

const savePexelsKey = asyncHandler(async (req, res) => {
    const config = await pexelsConfig.saveKey(req.body.apiKey, req.user._id);
    return sendSuccess(res, 'Pexels API key saved', { config });
});

const removePexelsKey = asyncHandler(async (req, res) => {
    const config = await pexelsConfig.removeKey(req.user._id);
    return sendSuccess(res, 'Pexels API key removed', { config });
});

const testPexelsConnection = asyncHandler(async (req, res) => {
    const result = await pexelsConfig.testConnection({ apiKey: req.body.apiKey || undefined });
    return sendSuccess(res, result.ok ? 'Connection successful' : 'Connection failed', { result });
});

// ── Blog generation (Super Admin, Editor) ──────────────────────────────────────

// Also reports the Gemini limits bulk generation works within.
const getAvailability = asyncHandler(async (req, res) => {
    const availability = {
        ...(await geminiConfig.availability()),
        limits: {
            requestsPerWindow: env.GEMINI_RATE_LIMIT_MAX,
            windowMinutes: Math.round(env.GEMINI_RATE_LIMIT_WINDOW_MS / 60000),
            maxParallel: geminiBlog.MAX_PARALLEL_PER_ADMIN
        }
    };
    return sendSuccess(res, 'Gemini availability fetched', { availability });
});

const generateBlog = asyncHandler(async (req, res) => {
    const result = await geminiBlog.generateBlog({
        topic: req.body.topic,
        createDate: req.body.createDate,
        category: req.body.category || undefined,
        tags: req.body.tags,
        seoKeywords: req.body.seoKeywords,
        rowKey: req.body.rowKey || undefined
    }, req.user._id);
    return sendSuccess(res, 'Blog generated', result);
});

// An AI featured image made for this article, with the Surjit Finance logo
// (or, when that fails and it is allowed, a branded Pexels photo).
const generateImage = asyncHandler(async (req, res) => {
    const image = await geminiBlog.generateImage({
        title: req.body.title,
        summary: req.body.summary,
        topic: req.body.topic,
        content: req.body.content,
        category: req.body.category || undefined,
        tags: req.body.tags || [],
        variation: req.body.variation || 0,
        imagePrompt: req.body.imagePrompt,
        excludePhotoIds: req.body.excludePhotoIds || [],
        rowKey: req.body.rowKey || undefined
    }, req.user._id);
    return sendSuccess(res, 'Featured image found', { image });
});

// Multipart sends the credit flattened (imageCredit.photographer, …) — keys
// with a dot, which express-validator would read as nested paths, so the
// credit is checked here. Only Pexels credits with pexels.com links are
// accepted; anything else is refused rather than stored.
const PEXELS_LINK = /^https:\/\/www\.pexels\.com\/[\x21-\x7E]{0,280}$/;
const creditFrom = (body) => {
    const pick = (k) => (typeof body[`imageCredit.${k}`] === 'string' ? body[`imageCredit.${k}`].trim() : '');
    const source = pick('source');
    if (!source) return null;
    const credit = {
        source,
        photoId: pick('photoId'),
        photoUrl: pick('photoUrl'),
        photographer: pick('photographer'),
        photographerUrl: pick('photographerUrl')
    };
    const errors = [];
    if (source !== 'pexels') errors.push({ field: 'imageCredit.source', message: 'Image credit source must be pexels' });
    if (credit.photoId && !/^\d{1,20}$/.test(credit.photoId)) errors.push({ field: 'imageCredit.photoId', message: 'Image credit photo id is invalid' });
    if (!PEXELS_LINK.test(credit.photoUrl)) errors.push({ field: 'imageCredit.photoUrl', message: 'Image credit photo URL must be a pexels.com link' });
    if (!PEXELS_LINK.test(credit.photographerUrl)) errors.push({ field: 'imageCredit.photographerUrl', message: 'Photographer URL must be a pexels.com link' });
    if (!credit.photographer || credit.photographer.length > 120 || /[<>]/.test(credit.photographer)) {
        errors.push({ field: 'imageCredit.photographer', message: 'Photographer name is missing or invalid' });
    }
    if (errors.length) throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, errors);
    return credit;
};

// Where the featured image came from (imageMeta.provider, ...), flattened the
// same way. Only the two automatic providers; a manual upload sends none.
const metaFrom = (body) => {
    const pick = (k) => (typeof body[`imageMeta.${k}`] === 'string' ? body[`imageMeta.${k}`].trim() : '');
    const provider = pick('provider');
    if (!provider) return null;
    const errors = [];
    if (!['gemini', 'pexels'].includes(provider)) errors.push({ field: 'imageMeta.provider', message: 'Image provider must be gemini or pexels' });
    const model = pick('model');
    if (provider === 'gemini' && !isUsableImageModel(model)) errors.push({ field: 'imageMeta.model', message: 'Image model must be a current Gemini image model' });
    const branded = pick('branded');
    if (branded && !['true', 'false'].includes(branded)) errors.push({ field: 'imageMeta.branded', message: 'branded must be true or false' });
    if (errors.length) throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, errors);
    return { provider, ...(provider === 'gemini' ? { model } : {}), ...(branded ? { branded: branded === 'true' } : {}) };
};

// ── Excel monthly plan (Super Admin, Editor) ──────────────────────────────────
// Planning only: nothing here calls Gemini or writes to the database, and the
// uploaded workbook is read from memory and discarded.

const bulkTemplate = asyncHandler(async (req, res) => {
    const buffer = await bulkPlan.buildTemplate();
    res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="gemini-blog-plan-template.xlsx"',
        'Cache-Control': 'no-store'
    });
    return res.status(HTTP_STATUS.OK).send(buffer);
});

const bulkParse = asyncHandler(async (req, res) => {
    const plan = await bulkPlan.parseWorkbook(req.file);
    return sendSuccess(res, `${plan.summary.valid} of ${plan.summary.total} rows are ready to generate`, plan);
});

const bulkValidate = asyncHandler(async (req, res) => {
    const plan = await bulkPlan.validateRows(req.body.rows);
    return sendSuccess(res, 'Rows validated', plan);
});

// Same body shape and file fields as the normal blog create endpoint, so the
// CMS builds it the same way; the service forces the status to draft. A
// repeated idempotency key answers 200 with the draft already saved.
const saveDraft = asyncHandler(async (req, res) => {
    const { idempotencyKey, planMonth: _month, ...rest } = req.body;
    const body = Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('imageCredit.') && !k.startsWith('imageMeta.')));
    const files = collectFiles(req);
    let imageCredit;
    let imageMeta;
    try {
        imageCredit = creditFrom(req.body);
        imageMeta = metaFrom(req.body);
    } catch (err) {
        // The upload middleware has already stored the image; a refused
        // request must not leave it behind.
        await Promise.all(Object.values(files).filter((f) => f && f.fileName).map((f) => deleteUploadedFile(f.fileName)));
        throw err;
    }
    const { blog, duplicate } = await geminiBlog.saveDraft(
        { ...normaliseBody(body), createDate: req.body.createDate, imageCredit, imageMeta },
        files,
        { userId: req.user._id, idempotencyKey }
    );
    return duplicate
        ? sendSuccess(res, 'Draft was already saved', { blog, duplicate: true }, HTTP_STATUS.OK)
        : sendSuccess(res, 'Draft saved', { blog, duplicate: false }, HTTP_STATUS.CREATED);
});

module.exports = {
    getConfig, saveConfig, removeKey, testConnection,
    getFallbacks, saveFallbacks, clearFallbacks,
    getPexelsConfig, savePexelsKey, removePexelsKey, testPexelsConnection,
    getAvailability, generateBlog, generateImage, saveDraft,
    bulkTemplate, bulkParse, bulkValidate
};
