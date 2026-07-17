const { body, param } = require('express-validator');

const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];

const submitApplicationValidation = [
    body('applicantName').trim().notEmpty().withMessage('Applicant name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required')
        .matches(/^[+\d\s\-().]{7,20}$/).withMessage('Phone number is invalid'),
    body('appliedPositionTitle').optional().trim(),
    body('coverLetter').optional().trim()
];

const updateStatusValidation = [
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(APPLICATION_STATUSES).withMessage(`Status must be one of: ${APPLICATION_STATUSES.join(', ')}`)
];

module.exports = { submitApplicationValidation, updateStatusValidation };
