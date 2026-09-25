const { body } = require('express-validator');



// Roles are records now, so a role is valid when it exists and is active —
// not when it appears in a list compiled at build time.
const roleMustExist = async (value) => {
    if (!value) return true;
    const Role = require('../models/Role');
    const role = await Role.findOne({ key: value }).select('status').lean();
    if (!role) throw new Error('That role does not exist');
    if (role.status !== 'Active') throw new Error('That role is not active');
    return true;
};

const createUserValidation = [
    body('name')
        .trim().notEmpty().withMessage('Name is required')
        .isLength({ max: 120 }).withMessage('Name must not exceed 120 characters'),
    body('email')
        .trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        // Matches the model's own minimum so the two cannot disagree.
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role')
        .optional().trim().toLowerCase()
        .custom(roleMustExist),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

// Every field optional: the CMS sends partial updates, and password is only
// present when an admin is actually resetting it.
const updateUserValidation = [
    body('name')
        .optional().trim().notEmpty().withMessage('Name cannot be empty')
        .isLength({ max: 120 }).withMessage('Name must not exceed 120 characters'),
    body('email')
        .optional().trim().notEmpty().withMessage('Email cannot be empty')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    body('password')
        .optional({ checkFalsy: true })
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role')
        .optional().trim().toLowerCase()
        .custom(roleMustExist),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

module.exports = { createUserValidation, updateUserValidation };
