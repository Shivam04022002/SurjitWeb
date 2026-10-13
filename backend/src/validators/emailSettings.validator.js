const { body, query, param } = require('express-validator');
const rules = require('../services/email/emailRules');
const { PROVIDERS, AUTH_METHODS } = require('../models/EmailSetting');
const zoned = require('../utils/zonedDate');
const { DISPLAY_STATUSES } = require('../services/email/notificationHistory.service');

// Email Settings input. Every message is written here and none echoes a
// submitted value, so a mistyped secret is never reflected back.

const emailField = (field, label) => body(field)
    .exists({ checkFalsy: true }).withMessage(`${label} is required`).bail()
    .isString().withMessage(`${label} must be text`).bail()
    .trim()
    .custom(rules.isEmail).withMessage('Enter a valid email address');

const saveEmailSettingsValidation = [
    body('provider').isIn(PROVIDERS).withMessage('Choose an email provider'),
    body('authMethod')
        .isIn(AUTH_METHODS).withMessage('Choose an authentication method').bail()
        .custom((authMethod, { req }) => rules.isSupported(req.body.provider, authMethod))
        .withMessage((authMethod, { req }) => rules.unsupportedMessage(req.body.provider, authMethod)),
    body('senderName')
        .optional({ values: 'null' })
        .isString().withMessage('Sender name must be text').bail()
        .trim()
        .isLength({ max: 100 }).withMessage('Sender name must not exceed 100 characters')
        // It becomes a mail header display name.
        .not().matches(/[\r\n\x00-\x1F\x7F]/).withMessage('Sender name must not contain line breaks or control characters'),
    emailField('senderEmail', 'Sender email'),
    body('tenantId')
        .exists({ checkFalsy: true }).withMessage('Tenant ID is required').bail()
        .isString().withMessage('Tenant ID must be text').bail()
        .trim()
        .custom(rules.isTenantId).withMessage('Enter your directory (tenant) ID or a verified domain such as contoso.onmicrosoft.com'),
    body('clientId')
        .exists({ checkFalsy: true }).withMessage('Application (client) ID is required').bail()
        .isString().withMessage('Application (client) ID must be text').bail()
        .trim()
        .custom(rules.isGuid).withMessage('Enter the application (client) ID in the form 00000000-0000-0000-0000-000000000000'),
    // Optional: blank keeps the secret already stored (the service decides
    // whether one is needed).
    body('clientSecret')
        .optional({ values: 'falsy' })
        .isString().withMessage('Client secret must be text').bail()
        .trim()
        .matches(rules.SECRET_RX).withMessage('Client secret must be 8-512 characters, with no spaces or line breaks'),
    emailField('primaryRecipient', 'Primary recipient'),
    body('additionalRecipients')
        .optional()
        .isArray({ max: rules.MAX_ADDITIONAL_RECIPIENTS }).withMessage(`Additional recipients must be a list of at most ${rules.MAX_ADDITIONAL_RECIPIENTS} addresses`).bail()
        .custom((list, { req }) => {
            const seen = new Set([rules.normaliseEmail(req.body.primaryRecipient)]);
            for (const r of list) {
                if (!rules.isEmail(r)) throw new Error('Every additional recipient must be a valid email address');
                const n = rules.normaliseEmail(r);
                if (seen.has(n)) throw new Error('Additional recipients must not repeat each other or the primary recipient');
                seen.add(n);
            }
            return true;
        }),
    body('notifyNewLoanApplication').optional().isBoolean({ strict: true }).withMessage('notifyNewLoanApplication must be true or false')
];

const sendTestEmailValidation = [emailField('recipient', 'Test recipient')];

// Email Delivery Log filters. Days are calendar days in the business timezone;
// a range is at most a year, so one request cannot ask for everything.
const MAX_RANGE_DAYS = 366;
const dayRule = (field) => query(field)
    .optional({ values: 'falsy' })
    .custom(zoned.isValidDay).withMessage(`${field} must be a date in the form YYYY-MM-DD`);

const listNotificationsValidation = [
    query('status').optional({ values: 'falsy' }).isString().withMessage('status must be text').bail().isIn(DISPLAY_STATUSES).withMessage(`status must be one of: ${DISPLAY_STATUSES.join(', ')}`),
    dayRule('from'),
    dayRule('to').bail()
        .custom((to, { req }) => !req.query.from || !zoned.isValidDay(req.query.from) || zoned.daysBetween(req.query.from, to) >= 0)
        .withMessage('to must not be before from').bail()
        .custom((to, { req }) => !req.query.from || !zoned.isValidDay(req.query.from) || zoned.daysBetween(req.query.from, to) < MAX_RANGE_DAYS)
        .withMessage(`The date range must not exceed ${MAX_RANGE_DAYS} days`),
    query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a whole number from 1 to 10000').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be a whole number from 1 to 100').toInt()
];

const notificationIdValidation = [param('id').isMongoId().withMessage('Invalid notification id')];

module.exports = { saveEmailSettingsValidation, sendTestEmailValidation, listNotificationsValidation, notificationIdValidation };
