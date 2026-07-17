const { body } = require('express-validator');

const careerValidation = [
    body('jobTitle').trim().notEmpty().withMessage('Job title is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('experience').trim().notEmpty().withMessage('Experience is required'),
    body('location').trim().notEmpty().withMessage('Preferred location is required')
];

module.exports = { careerValidation };
