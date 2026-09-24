const { body, param } = require('express-validator');

// The button may point at a page on this site ("/loan-application") or at a
// full http(s) address. Anything else — javascript:, data:, mailto: — is
// refused, since the value ends up in a link a visitor clicks.
const applyUrlRule = (chain) => chain
    .custom((value) => {
        if (!value) return true;
        if (value.startsWith('/')) return !/^\/\//.test(value) && !/[\s?#]*javascript:/i.test(value);
        try {
            const url = new URL(value);
            return url.protocol === 'https:' || url.protocol === 'http:';
        } catch {
            return false;
        }
    })
    .withMessage('Apply URL must be a page on this site (/path) or a full http(s) address')
    .isLength({ max: 500 }).withMessage('Apply URL must not exceed 500 characters');

// Optional on update because the CMS sends only the fields being changed; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('name').trim().notEmpty().withMessage('Name is required'))
            .isLength({ max: 150 }).withMessage('Name must not exceed 150 characters'),

        applyUrlRule(body('applyUrl').optional({ checkFalsy: true }).trim()),

        body('applyButtonText').optional({ checkFalsy: true }).trim()
            .isLength({ max: 40 }).withMessage('Apply button text must not exceed 40 characters'),

        // The artwork arrives as an uploaded file, never as a link: a client
        // cannot point an advertisement at an image it does not own, and the
        // stored address always comes from the upload middleware.
        body('imageUrl').not().exists()
            .withMessage('Upload the image file; an image URL cannot be set directly'),

        // An `image` that reaches the parsed body was not sent as a file: the
        // request was JSON, or the field carried something other than an
        // upload. Multer moves a real file to req.file and leaves nothing
        // here, so this can only be a caller that thinks it attached an image
        // when it did not — refused, rather than saved as a success with no
        // artwork.
        body('image').not().exists()
            .withMessage('Send the image as a file upload (multipart/form-data), not as a field'),
        body('imageFileName').not().exists()
            .withMessage('The image file name is set by the upload'),

        // Publishing is its own action (PATCH /:id/publish), so a status in the
        // body is refused rather than quietly ignored.
        body('status').not().exists()
            .withMessage('Use the publish and unpublish actions to change status'),
        body('publishedAt').not().exists()
            .withMessage('publishedAt is set by publishing, not by an update')
    ];
};

const advertisementIdRule = [param('id').isMongoId().withMessage('Invalid advertisement id')];

const createAdvertisementValidation = sharedRules(true);
const updateAdvertisementValidation = [...advertisementIdRule, ...sharedRules(false)];

module.exports = {
    createAdvertisementValidation,
    updateAdvertisementValidation,
    advertisementIdRule
};
