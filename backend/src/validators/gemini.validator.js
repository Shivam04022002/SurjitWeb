const { body } = require('express-validator');
const { createBlogValidation } = require('./blog/blogs.validator');
const { MODEL_RX } = require('../services/gemini/geminiClient');
const zoned = require('../utils/zonedDate');

// Gemini keys are URL-safe tokens. The rule only bounds the shape; whether a
// key actually works is what Test Connection is for. Validation messages never
// echo the submitted value.
const apiKeyRule = (field = 'apiKey') => body(field)
    .optional({ checkFalsy: true })
    .isString().withMessage('API key must be text')
    .trim()
    .isLength({ min: 20, max: 200 }).withMessage('API key must be 20-200 characters')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('API key contains invalid characters');

const modelRule = (field) => body(field)
    .optional()
    .isString().withMessage(`${field} must be text`)
    .trim()
    .custom((v) => v === '' || MODEL_RX.test(v)).withMessage(`${field} is not a valid Gemini model name`);

const saveConfigValidation = [
    apiKeyRule(),
    modelRule('textModel'),
    modelRule('imageModel'),
    body('imageGenerationEnabled').optional().isBoolean().withMessage('imageGenerationEnabled must be true or false').toBoolean()
];

const testConnectionValidation = [apiKeyRule()];

// The admin's create date: a real calendar day, not before 2000 and not more
// than a year ahead.
const createDateRule = () => body('createDate')
    .custom((v) => zoned.isValidDay(v)).withMessage('Create date must be a valid date (YYYY-MM-DD)')
    .bail()
    .custom((v) => v >= '2000-01-01' && v <= zoned.addDays(zoned.today(), 365))
    .withMessage('Create date must be between 2000 and one year from today');

const generateBlogValidation = [
    body('topic')
        .isString().withMessage('Blog name / topic is required')
        .trim()
        .notEmpty().withMessage('Blog name / topic is required')
        .isLength({ min: 3, max: 200 }).withMessage('Blog name / topic must be 3-200 characters'),
    createDateRule()
];

const generateImageValidation = [
    body('title').isString().trim().notEmpty().withMessage('Title is required')
        .isLength({ max: 250 }).withMessage('Title must not exceed 250 characters'),
    body('summary').optional().isString().trim()
        .isLength({ max: 1000 }).withMessage('Summary must not exceed 1000 characters'),
    body('imagePrompt').optional().isString().trim()
        .isLength({ max: 1000 }).withMessage('Image description must not exceed 1000 characters')
];

// Every rule the normal blog create endpoint applies, plus the create date.
const saveDraftValidation = [...createBlogValidation, createDateRule()];

module.exports = {
    saveConfigValidation,
    testConnectionValidation,
    generateBlogValidation,
    generateImageValidation,
    saveDraftValidation
};
