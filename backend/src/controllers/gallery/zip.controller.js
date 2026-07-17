const zipService = require('../../services/gallery/zip.service');
const { AppError } = require('../../middleware/errorHandler');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const MAX_ZIP_SIZE = 200 * 1024 * 1024; // 200 MB

const importZip = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('ZIP file is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (req.file.size > MAX_ZIP_SIZE) {
        throw new AppError('ZIP file exceeds the 200 MB limit', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await zipService.importZip(req.params.albumId, req.file.buffer);

    return sendSuccess(res, `ZIP import complete: ${result.uploaded} uploaded, ${result.skipped} skipped, ${result.failed} failed`, result, HTTP_STATUS.CREATED);
});

module.exports = { importZip };
