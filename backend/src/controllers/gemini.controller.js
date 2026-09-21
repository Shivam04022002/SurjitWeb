const geminiConfig = require('../services/gemini/geminiConfig.service');
const geminiBlog = require('../services/gemini/geminiBlog.service');
const { normaliseBody, collectFiles } = require('./blog/blogs.controller');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
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

const getAvailability = asyncHandler(async (req, res) => {
    const availability = await geminiConfig.availability();
    return sendSuccess(res, 'Gemini availability fetched', { availability });
});

const generateBlog = asyncHandler(async (req, res) => {
    const result = await geminiBlog.generateBlog(
        { topic: req.body.topic, createDate: req.body.createDate },
        req.user._id
    );
    return sendSuccess(res, 'Blog generated', result);
});

const generateImage = asyncHandler(async (req, res) => {
    const image = await geminiBlog.generateImage(
        { title: req.body.title, summary: req.body.summary, imagePrompt: req.body.imagePrompt },
        req.user._id
    );
    return sendSuccess(res, 'Featured image generated', { image });
});

// Same body shape and file fields as the normal blog create endpoint, so the
// CMS builds it the same way; the service forces the status to draft.
const saveDraft = asyncHandler(async (req, res) => {
    const blog = await geminiBlog.saveDraft(
        { ...normaliseBody(req.body), createDate: req.body.createDate },
        collectFiles(req)
    );
    return sendSuccess(res, 'Draft saved', { blog }, HTTP_STATUS.CREATED);
});

module.exports = {
    getConfig, saveConfig, removeKey, testConnection,
    getAvailability, generateBlog, generateImage, saveDraft
};
