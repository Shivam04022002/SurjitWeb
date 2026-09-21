const geminiConfig = require('../services/gemini/geminiConfig.service');
const geminiBlog = require('../services/gemini/geminiBlog.service');
const { normaliseBody, collectFiles } = require('./blog/blogs.controller');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

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
        imageGenerationEnabled: req.body.imageGenerationEnabled
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

// ── Blog generation (Super Admin, Editor) ──────────────────────────────────────

// Also reports the limits the monthly flow plans around, so the CMS can tell
// an admin up front how many Gemini requests a month will take.
const getAvailability = asyncHandler(async (req, res) => {
    const availability = {
        ...(await geminiConfig.availability()),
        limits: {
            requestsPerWindow: env.GEMINI_RATE_LIMIT_MAX,
            windowMinutes: Math.round(env.GEMINI_RATE_LIMIT_WINDOW_MS / 60000),
            maxMonthlyBlogs: geminiBlog.MAX_MONTHLY_BLOGS,
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

const generateImage = asyncHandler(async (req, res) => {
    const image = await geminiBlog.generateImage(
        { title: req.body.title, summary: req.body.summary, imagePrompt: req.body.imagePrompt, rowKey: req.body.rowKey || undefined },
        req.user._id
    );
    return sendSuccess(res, 'Featured image generated', { image });
});

const planMonth = asyncHandler(async (req, res) => {
    const plan = await geminiBlog.planMonth(
        { year: req.body.year, month: req.body.month, count: req.body.count },
        req.user._id
    );
    return sendSuccess(res, 'Monthly plan generated', plan);
});

// Same body shape and file fields as the normal blog create endpoint, so the
// CMS builds it the same way; the service forces the status to draft. A
// repeated idempotency key answers 200 with the draft already saved.
const saveDraft = asyncHandler(async (req, res) => {
    const { idempotencyKey, planMonth: _month, ...body } = req.body;
    const { blog, duplicate } = await geminiBlog.saveDraft(
        { ...normaliseBody(body), createDate: req.body.createDate },
        collectFiles(req),
        { userId: req.user._id, idempotencyKey }
    );
    return duplicate
        ? sendSuccess(res, 'Draft was already saved', { blog, duplicate: true }, HTTP_STATUS.OK)
        : sendSuccess(res, 'Draft saved', { blog, duplicate: false }, HTTP_STATUS.CREATED);
});

module.exports = {
    getConfig, saveConfig, removeKey, testConnection,
    getAvailability, generateBlog, generateImage, planMonth, saveDraft
};
