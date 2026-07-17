const { body } = require('express-validator');

// ── Features ──────────────────────────────────────────────────────────────────

const createFeatureValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Feature title is required')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

const updateFeatureValidation = [
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Feature title cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

// ── Eligibility ───────────────────────────────────────────────────────────────

const createEligibilityValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Eligibility title is required')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

const updateEligibilityValidation = [
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Eligibility title cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

// ── Documents ─────────────────────────────────────────────────────────────────

const createDocumentValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Document title is required')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

const updateDocumentValidation = [
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Document title cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

// ── Interest Rates ────────────────────────────────────────────────────────────

const createInterestRateValidation = [
    body('loanAmountFrom')
        .notEmpty()
        .withMessage('Loan amount from is required')
        .isFloat({ min: 0 })
        .withMessage('Loan amount from must be a non-negative number'),

    body('loanAmountTo')
        .notEmpty()
        .withMessage('Loan amount to is required')
        .isFloat({ min: 0 })
        .withMessage('Loan amount to must be a non-negative number'),

    body('interestRate')
        .notEmpty()
        .withMessage('Interest rate is required')
        .isFloat({ min: 0, max: 100 })
        .withMessage('Interest rate must be between 0 and 100'),

    body('tenure')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Tenure must not exceed 100 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

const updateInterestRateValidation = [
    body('loanAmountFrom')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Loan amount from must be a non-negative number'),

    body('loanAmountTo')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Loan amount to must be a non-negative number'),

    body('interestRate')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Interest rate must be between 0 and 100'),

    body('tenure')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Tenure must not exceed 100 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

// ── FAQs ──────────────────────────────────────────────────────────────────────

const createFaqValidation = [
    body('question')
        .trim()
        .notEmpty()
        .withMessage('Question is required')
        .isLength({ max: 500 })
        .withMessage('Question must not exceed 500 characters'),

    body('answer')
        .trim()
        .notEmpty()
        .withMessage('Answer is required')
        .isLength({ max: 2000 })
        .withMessage('Answer must not exceed 2000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

const updateFaqValidation = [
    body('question')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Question cannot be empty')
        .isLength({ max: 500 })
        .withMessage('Question must not exceed 500 characters'),

    body('answer')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Answer cannot be empty')
        .isLength({ max: 2000 })
        .withMessage('Answer must not exceed 2000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer')
];

// ── EMI Config ────────────────────────────────────────────────────────────────

const updateEmiConfigValidation = [
    body('minimumAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum amount must be non-negative'),

    body('maximumAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum amount must be non-negative'),

    body('defaultAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Default amount must be non-negative'),

    body('interestRate')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Interest rate must be between 0 and 100'),

    body('minimumTenure')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Minimum tenure must be at least 1'),

    body('maximumTenure')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Maximum tenure must be at least 1'),

    body('defaultTenure')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Default tenure must be at least 1')
];

// ── SEO ───────────────────────────────────────────────────────────────────────

const updateSeoValidation = [
    body('metaTitle')
        .optional()
        .trim()
        .isLength({ max: 160 })
        .withMessage('Meta title must not exceed 160 characters'),

    body('metaDescription')
        .optional()
        .trim()
        .isLength({ max: 320 })
        .withMessage('Meta description must not exceed 320 characters'),

    body('metaKeywords')
        .optional()
        .trim(),

    body('canonicalUrl')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Canonical URL must be a valid URL')
];

// ── Shared Reorder ────────────────────────────────────────────────────────────

const reorderValidation = [
    body('ids')
        .isArray({ min: 1 })
        .withMessage('ids must be a non-empty array'),

    body('ids.*')
        .notEmpty()
        .withMessage('Each id must be a non-empty string')
];

module.exports = {
    createFeatureValidation,
    updateFeatureValidation,
    createEligibilityValidation,
    updateEligibilityValidation,
    createDocumentValidation,
    updateDocumentValidation,
    createInterestRateValidation,
    updateInterestRateValidation,
    createFaqValidation,
    updateFaqValidation,
    updateEmiConfigValidation,
    updateSeoValidation,
    reorderValidation
};
