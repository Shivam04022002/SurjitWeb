const { body } = require('express-validator');

const loanValidation = [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('dob').isDate().withMessage('Valid date of birth is required'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
    body('pan').trim().isLength({ min: 10, max: 10 }).withMessage('Valid PAN is required'),
    body('aadhaar').trim().isLength({ min: 12, max: 12 }).withMessage('Valid Aadhaar is required'),
    body('loanType').isIn(['business', 'vehicle', 'lap']).withMessage('Valid loan type is required'),
    body('loanAmount').isNumeric().withMessage('Valid loan amount is required'),
    body('tenure').isNumeric().withMessage('Valid tenure is required'),
    body('employmentType').isIn(['self-employed', 'business-owner', 'salaried']).withMessage('Valid employment type is required'),
    body('monthlyIncome').isNumeric().withMessage('Valid monthly income is required')
];

module.exports = { loanValidation };
