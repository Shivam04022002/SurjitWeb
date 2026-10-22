const { body, param } = require('express-validator');

// Share to LinkedIn input. The browser sends only a blog ID, the caption and
// an explicit confirmation — never the page, the address or the image, which
// the server takes from the stored blog and its own configuration. Messages
// never echo a submitted value.

const blogIdParam = param('blogId').isMongoId().withMessage('That is not a valid blog ID');

const publishValidation = [
    blogIdParam,
    body('caption')
        .exists().withMessage('Write a caption for the LinkedIn post').bail()
        .isString().withMessage('The caption must be text'),
    body('confirm')
        .exists().withMessage('Publishing to LinkedIn needs explicit confirmation').bail()
        .isBoolean({ strict: true }).withMessage('Publishing to LinkedIn needs explicit confirmation')
];

const resolveValidation = [
    blogIdParam,
    body('outcome').isIn(['published', 'not_published']).withMessage('Choose whether the post is on LinkedIn or not'),
    body('postUrn').optional({ values: 'falsy' }).isString().withMessage('The post URN must be text').bail()
        .isLength({ max: 200 }).withMessage('The post URN is too long')
];

// API Settings → LinkedIn. Types only here; the configuration service checks
// formats (and normalises the page ID) with messages that never echo a value,
// and refuses fields managed by the server environment.
const optionalText = (field, label, max) => body(field)
    .optional()
    .isString().withMessage(`${label} must be text`).bail()
    .isLength({ max }).withMessage(`${label} is too long`);

const saveConfigValidation = [
    optionalText('clientId', 'The client ID', 64),
    optionalText('clientSecret', 'The client secret', 256),
    body('organizationId').optional()
        .custom((v) => typeof v === 'string' || (typeof v === 'number' && Number.isInteger(v)))
        .withMessage('The company page ID must be a number').bail()
        .custom((v) => String(v).length <= 60).withMessage('The company page ID is too long'),
    optionalText('apiVersion', 'The API version', 6),
    body('verifyRole').optional().isBoolean({ strict: true }).withMessage('Verify page role must be true or false')
];

module.exports = { blogIdParam, publishValidation, resolveValidation, saveConfigValidation };
