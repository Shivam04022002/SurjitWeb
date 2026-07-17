const { body } = require('express-validator');

const loginValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Valid email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

const refreshTokenValidation = [
    // The refresh token normally arrives as an httpOnly cookie; accept the body
    // value as a fallback but do not require it when the cookie is present.
    body('refreshToken')
        .custom((value, { req }) => {
            if (req.cookies?.refreshToken || value) {
                return true;
            }
            throw new Error('Refresh token is required');
        })
];

module.exports = {
    loginValidation,
    changePasswordValidation,
    refreshTokenValidation
};
