const settingsService = require('../../services/career/settings.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings();
    return sendSuccess(res, 'Career settings fetched successfully', { settings });
});

const updateSettings = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (data.seo && typeof data.seo === 'string') {
        try { data.seo = JSON.parse(data.seo); } catch (_) { delete data.seo; }
    }

    if (req.files) {
        const existing = await settingsService.getSettings();

        if (req.files.heroBannerImage && req.files.heroBannerImage[0]) {
            if (existing.heroBannerImage && existing.heroBannerImage.fileName) {
                await deleteUploadedFile(existing.heroBannerImage.fileName);
            }
            data.heroBannerImage = buildFileResult(req.files.heroBannerImage[0]);
        }

        if (req.files.whyJoinImage && req.files.whyJoinImage[0]) {
            if (existing.whyJoinImage && existing.whyJoinImage.fileName) {
                await deleteUploadedFile(existing.whyJoinImage.fileName);
            }
            data.whyJoinImage = buildFileResult(req.files.whyJoinImage[0]);
        }

        if (req.files['seo.ogImage'] && req.files['seo.ogImage'][0]) {
            if (existing.seo && existing.seo.ogImage && existing.seo.ogImage.fileName) {
                await deleteUploadedFile(existing.seo.ogImage.fileName);
            }
            if (!data.seo) data.seo = {};
            data.seo.ogImage = buildFileResult(req.files['seo.ogImage'][0]);
        }
    }

    const settings = await settingsService.updateSettings(data);
    return sendSuccess(res, 'Career settings updated successfully', { settings });
});

module.exports = { getSettings, updateSettings };
