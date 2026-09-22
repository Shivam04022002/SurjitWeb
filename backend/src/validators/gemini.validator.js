const { body } = require('express-validator');
const { createBlogValidation } = require('./blog/blogs.validator');
const { MODEL_RX } = require('../services/gemini/geminiClient');
const { NOT_A_FREE_TEXT_MODEL } = require('../services/gemini/textModels');
const zoned = require('../utils/zonedDate');

// Google issues keys in more than one format: classic "AIza…" keys and the
// newer "AQ.…" keys, whose period an earlier allowlist of [A-Za-z0-9_-]
// rejected. So the rule does not guess at Google's alphabet: any visible
// ASCII character is accepted, and only what cannot be part of a key sent
// in an HTTP header is refused — spaces, line breaks and other control
// characters. Surrounding whitespace from a paste is trimmed; the key itself
// is otherwise stored and sent exactly as entered. Whether it works is what
// Test Connection is for. Messages never echo the submitted value.
const apiKeyRule = (field = 'apiKey') => body(field)
    .optional({ checkFalsy: true })
    .isString().withMessage('API key must be text')
    .trim()
    .isLength({ min: 20, max: 512 }).withMessage('API key must be 20-512 characters')
    .matches(/^[\x21-\x7E]+$/).withMessage('API key must not contain spaces, line breaks or special control characters');

const modelRule = (field) => body(field)
    .optional()
    .isString().withMessage(`${field} must be text`)
    .trim()
    .custom((v) => v === '' || MODEL_RX.test(v)).withMessage(`${field} is not a valid Gemini model name`);

const saveConfigValidation = [
    apiKeyRule(),
    // Blogs are written by a text model; an image, video or audio model is
    // never accepted here (featured images come from Pexels, not Gemini).
    modelRule('textModel')
        .custom((v) => !v || !NOT_A_FREE_TEXT_MODEL.test(v)).withMessage('textModel must be a Gemini text model, not an image, audio or video model'),
    modelRule('imageModel'),
    body('imageGenerationEnabled').optional().isBoolean().withMessage('imageGenerationEnabled must be true or false').toBoolean()
];

const testConnectionValidation = [apiKeyRule()];

// Pexels keys follow the same rule. Saving needs a key; a test may try a
// typed key or, without one, the key in use.
const savePexelsKeyValidation = [
    body('apiKey').exists({ checkFalsy: true }).withMessage('Enter a Pexels API key').bail(),
    apiKeyRule()
];
const testPexelsValidation = [apiKeyRule()];

// Free fallback models: the list's shape here; each name (text models only,
// no duplicates, not the primary model) is checked by the service, which
// knows the primary model.
const saveFallbacksValidation = [
    body('models').isArray({ max: 20 }).withMessage('Fallback models must be a list of model names')
];

// The admin's create date: a real calendar day, not before 2000 and not more
// than a year ahead.
const createDateRule = () => body('createDate')
    .custom((v) => zoned.isValidDay(v)).withMessage('Create date must be a valid date (YYYY-MM-DD)')
    .bail()
    .custom((v) => v >= '2000-01-01' && v <= zoned.addDays(zoned.today(), 365))
    .withMessage('Create date must be between 2000 and one year from today');

// Client-generated identifiers: a monthly row's key (one running generation
// per row) and a draft's idempotency key.
const clientKeyRule = (field) => body(field)
    .optional({ checkFalsy: true })
    .isString().withMessage(`${field} must be text`)
    .matches(/^[A-Za-z0-9_-]{8,64}$/).withMessage(`${field} has an invalid format`);

const stringListRule = (field, maxItems) => body(field)
    .optional()
    .isArray({ max: maxItems }).withMessage(`${field} must be a list of at most ${maxItems} items`)
    .bail()
    .custom((list) => list.every((v) => typeof v === 'string' && v.length <= 100))
    .withMessage(`${field} must contain short text values`);

const generateBlogValidation = [
    body('topic')
        .isString().withMessage('Blog name / topic is required')
        .trim()
        .notEmpty().withMessage('Blog name / topic is required')
        .isLength({ min: 3, max: 200 }).withMessage('Blog name / topic must be 3-200 characters'),
    createDateRule(),
    // Optional hints from a monthly plan row. The category must also be an
    // active one; the service checks that against the database.
    body('category').optional({ checkFalsy: true })
        .isMongoId().withMessage('Category must be a valid id'),
    stringListRule('tags', 20),
    stringListRule('seoKeywords', 20),
    clientKeyRule('rowKey')
];

const generateImageValidation = [
    body('title').isString().trim().notEmpty().withMessage('Title is required')
        .isLength({ max: 250 }).withMessage('Title must not exceed 250 characters'),
    body('summary').optional().isString().trim()
        .isLength({ max: 1000 }).withMessage('Summary must not exceed 1000 characters'),
    body('imagePrompt').optional().isString().trim()
        .isLength({ max: 1000 }).withMessage('Image description must not exceed 1000 characters'),
    body('topic').optional().isString().trim()
        .isLength({ max: 200 }).withMessage('Topic must not exceed 200 characters'),
    // Photos already offered for this blog, so "find another" skips them.
    body('excludePhotoIds').optional().isArray({ max: 50 }).withMessage('excludePhotoIds must be a short list')
        .bail()
        .custom((ids) => ids.every((id) => /^\d{1,20}$/.test(String(id)))).withMessage('excludePhotoIds must be Pexels photo ids'),
    clientKeyRule('rowKey')
];

// Plan rows edited in the CMS, sent back for the same validation an upload
// gets. Shapes only; the rules themselves live in bulkPlan.service.
const validateBulkRowsValidation = [
    body('rows').isArray({ min: 1, max: 200 }).withMessage('rows must be a list of 1-200 plan rows'),
    body('rows').custom((rows) => rows.every((r) => r && typeof r === 'object'
        && ['string', 'number', 'undefined'].includes(typeof r.date) && (r.date === undefined || String(r.date).length <= 40)
        && ['string', 'undefined'].includes(typeof r.topic) && (r.topic === undefined || r.topic.length <= 500)
        && ['string', 'undefined'].includes(typeof r.category) && (r.category === undefined || r.category.length <= 200)
        && ['string', 'boolean', 'undefined'].includes(typeof r.generateImage)
        && (r.sourceRow === undefined || r.sourceRow === null || Number.isInteger(r.sourceRow))))
        .withMessage('Each row needs text values for date, topic, category and generateImage')
];

// Every rule the normal blog create endpoint applies, plus the create date.
// A monthly save also names its month, and the date must fall inside it.
const saveDraftValidation = [
    ...createBlogValidation,
    createDateRule(),
    clientKeyRule('idempotencyKey'),
    body('planMonth').optional({ checkFalsy: true })
        .matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('planMonth must be YYYY-MM')
        .bail()
        .custom((planMonth, { req }) => String(req.body.createDate || '').startsWith(`${planMonth}-`))
        .withMessage('Create date must be inside the planned month')
];

module.exports = {
    saveConfigValidation,
    testConnectionValidation,
    savePexelsKeyValidation,
    testPexelsValidation,
    saveFallbacksValidation,
    generateBlogValidation,
    generateImageValidation,
    validateBulkRowsValidation,
    saveDraftValidation
};
