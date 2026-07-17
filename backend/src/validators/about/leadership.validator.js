const { body } = require('express-validator');
const { TEAM_TYPE_VALUES } = require('../../constants/teamTypes');

const createLeadershipValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 200 })
        .withMessage('Name must not exceed 200 characters'),

    body('designation')
        .trim()
        .notEmpty()
        .withMessage('Designation is required')
        .isLength({ max: 200 })
        .withMessage('Designation must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),

    body('linkedinUrl')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('LinkedIn URL must be a valid URL')
];

const updateLeadershipValidation = [
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Name cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Name must not exceed 200 characters'),

    body('designation')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Designation cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Designation must not exceed 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),

    body('linkedinUrl')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('LinkedIn URL must be a valid URL')
];

const reorderValidation = [
    body('ids')
        .isArray({ min: 1 })
        .withMessage('ids must be a non-empty array'),

    body('ids.*')
        .notEmpty()
        .withMessage('Each id must be a non-empty string')
];

const transferValidation = [
    body('targetTeam')
        .trim()
        .notEmpty()
        .withMessage('targetTeam is required')
        .bail()
        .isIn(TEAM_TYPE_VALUES)
        .withMessage(`targetTeam must be one of: ${TEAM_TYPE_VALUES.join(', ')}`)
];

module.exports = {
    createLeadershipValidation,
    updateLeadershipValidation,
    reorderValidation,
    transferValidation
};
