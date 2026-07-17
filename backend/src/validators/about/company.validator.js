const { body } = require('express-validator');

const updateCompanyValidation = [
    body('companyName')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Company name must not exceed 200 characters'),

    body('tagline')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('Tagline must not exceed 300 characters'),

    body('aboutDescription')
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage('About description must not exceed 5000 characters'),

    body('mission')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Mission must not exceed 2000 characters'),

    body('vision')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Vision must not exceed 2000 characters'),

    body('history')
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage('History must not exceed 5000 characters'),

    body('heroTitle')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Hero title must not exceed 200 characters'),

    body('heroSubtitle')
        .optional()
        .trim()
        .isLength({ max: 400 })
        .withMessage('Hero subtitle must not exceed 400 characters')
];

module.exports = { updateCompanyValidation };
