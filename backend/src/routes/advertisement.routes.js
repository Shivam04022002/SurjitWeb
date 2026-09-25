const express = require('express');
const { validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { buildFileResult, deleteUploadedFile } = require('../services/upload.service');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');

const advertisementController = require('../controllers/advertisement.controller');
const {
    createAdvertisementValidation,
    updateAdvertisementValidation,
    advertisementIdRule
} = require('../validators/advertisement.validator');

const router = express.Router();

// Same bands as the other content modules: everyone who can read the CMS can
// see advertisements; Super Admin and Editor create, edit and publish them;
// deleting is Super Admin only. There is no public route here — the website
// reads the published advertisement through /api/public/advertisement.
const canRead = [auth, viewPage('advertisements')];
const canManage = [auth, editPage('advertisements')];
const superAdminOnly = [auth, editPage('advertisements')];

// The artwork, through the CMS's own upload middleware: S3 when the server is
// configured for it, local disk otherwise, with the key generated server-side
// under its own prefix. Photographic formats only and a limit of its own —
// the 10 MB default belongs to documents, not to a popup image.
const MAX_AD_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AD_IMAGES = 'PNG, JPG/JPEG or WebP';

const adImageUpload = (req, res, next) => createUpload({
    folder: 'advertisements',
    fileTypes: 'adImages',
    maxSize: MAX_AD_IMAGE_BYTES
}).single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`The image is larger than ${MAX_AD_IMAGE_BYTES / 1024 / 1024} MB.`, HTTP_STATUS.BAD_REQUEST));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('Send the image in the "image" field.', HTTP_STATUS.BAD_REQUEST));
    }
    // Wrong type, or anything else multer refused. The message never carries
    // a filesystem path.
    return next(new AppError(`The image must be ${ALLOWED_AD_IMAGES}.`, HTTP_STATUS.BAD_REQUEST));
});

// The upload middleware has already stored the file by the time the field
// rules run, so a request about to be rejected takes its file with it instead
// of leaving it behind in storage.
const discardUploadIfInvalid = async (req, res, next) => {
    if (req.file && !validationResult(req).isEmpty()) {
        await deleteUploadedFile(buildFileResult(req.file).fileName);
        req.file = undefined;
    }
    next();
};

router.get('/', canRead, advertisementController.listAdvertisements);
router.get('/:id', canRead, advertisementIdRule, validate, advertisementController.getAdvertisementById);

router.post('/', canManage, adImageUpload, createAdvertisementValidation, discardUploadIfInvalid, validate, advertisementController.createAdvertisement);
router.put('/:id', canManage, adImageUpload, updateAdvertisementValidation, discardUploadIfInvalid, validate, advertisementController.updateAdvertisement);

router.patch('/:id/publish', canManage, advertisementIdRule, validate, advertisementController.publishAdvertisement);
router.patch('/:id/unpublish', canManage, advertisementIdRule, validate, advertisementController.unpublishAdvertisement);

router.delete('/:id', superAdminOnly, advertisementIdRule, validate, advertisementController.deleteAdvertisement);

module.exports = router;
module.exports.MAX_AD_IMAGE_BYTES = MAX_AD_IMAGE_BYTES;
