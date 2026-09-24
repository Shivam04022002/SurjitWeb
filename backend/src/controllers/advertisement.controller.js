const advertisementService = require('../services/advertisement.service');
const { buildFileResult, deleteUploadedFile } = require('../services/upload.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// The CMS manages advertisements; the website reads the published one
// through the public endpoint below.
//
// Create and update accept multipart with an optional `image` field, the same
// way blogs and gallery items do. By the time a handler runs, the upload
// middleware has already stored the file and the request carries only where it
// landed — never a path chosen by the client, and never a bucket name.

// The stored file, in the shape the service saves. Null when no image came
// with the request, which leaves any existing one alone.
const uploadedImage = (req) => (req.file ? buildFileResult(req.file) : null);

// A request refused after the file was stored must not leave it behind.
const discardUpload = async (image) => {
    if (image && image.fileName) await deleteUploadedFile(image.fileName);
};

// ── Public ─────────────────────────────────────────────────────────────────────

// Read-only, unauthenticated: the published advertisement, or null when there
// is none to show. Nothing about the request changes what comes back.
const getPublicAdvertisement = asyncHandler(async (req, res) => {
    const advertisement = await advertisementService.getPublicAdvertisement();
    return sendSuccess(res, 'Advertisement fetched successfully', { advertisement });
});

// ── CMS ────────────────────────────────────────────────────────────────────────

const listAdvertisements = asyncHandler(async (req, res) => {
    const result = await advertisementService.listAdvertisements(req.query);
    return sendSuccess(res, 'Advertisements fetched successfully', result);
});

const getAdvertisementById = asyncHandler(async (req, res) => {
    const advertisement = await advertisementService.getAdvertisementById(req.params.id);
    return sendSuccess(res, 'Advertisement fetched successfully', { advertisement });
});

const createAdvertisement = asyncHandler(async (req, res) => {
    const image = uploadedImage(req);
    try {
        const advertisement = await advertisementService.createAdvertisement(req.body, image);
        return sendSuccess(res, 'Advertisement created successfully', { advertisement }, HTTP_STATUS.CREATED);
    } catch (err) {
        // The record was not written, so the file it would have pointed at is
        // removed rather than orphaned.
        await discardUpload(image);
        throw err;
    }
});

const updateAdvertisement = asyncHandler(async (req, res) => {
    const image = uploadedImage(req);
    try {
        const advertisement = await advertisementService.updateAdvertisement(req.params.id, req.body, image);
        return sendSuccess(res, 'Advertisement updated successfully', { advertisement });
    } catch (err) {
        // The advertisement still refers to its previous image; the new upload
        // is the one that goes.
        await discardUpload(image);
        throw err;
    }
});

const publishAdvertisement = asyncHandler(async (req, res) => {
    const advertisement = await advertisementService.publishAdvertisement(req.params.id);
    return sendSuccess(res, 'Advertisement published successfully', { advertisement });
});

const unpublishAdvertisement = asyncHandler(async (req, res) => {
    const advertisement = await advertisementService.unpublishAdvertisement(req.params.id);
    return sendSuccess(res, 'Advertisement unpublished successfully', { advertisement });
});

const deleteAdvertisement = asyncHandler(async (req, res) => {
    const result = await advertisementService.deleteAdvertisement(req.params.id);
    return sendSuccess(res, 'Advertisement deleted successfully', result);
});

module.exports = {
    getPublicAdvertisement,
    listAdvertisements,
    getAdvertisementById,
    createAdvertisement,
    updateAdvertisement,
    publishAdvertisement,
    unpublishAdvertisement,
    deleteAdvertisement
};
