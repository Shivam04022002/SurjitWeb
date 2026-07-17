const settingsService = require('../services/settings.service');
const { buildFileResult, deleteUploadedFile } = require('../services/upload.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const LOGO_FIELDS = ['primaryLogo', 'whiteLogo', 'mobileLogo', 'favicon'];

const getSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings();
    return sendSuccess(res, 'Global settings fetched successfully', { settings });
});

const updateSettings = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    // Parse nested businessHours if sent as JSON string
    if (data.businessHours && typeof data.businessHours === 'string') {
        try { data.businessHours = JSON.parse(data.businessHours); } catch (_) { delete data.businessHours; }
    }

    // Handle logo/favicon uploads
    if (req.files) {
        const existing = await settingsService.getSettings();

        for (const field of LOGO_FIELDS) {
            if (req.files[field] && req.files[field][0]) {
                if (existing[field] && existing[field].fileName) {
                    await deleteUploadedFile(existing[field].fileName);
                }
                data[field] = buildFileResult(req.files[field][0]);
            }
        }
    }

    const settings = await settingsService.updateSettings(data);
    return sendSuccess(res, 'Global settings updated successfully', { settings });
});

module.exports = { getSettings, updateSettings };
