const companyService = require('../../services/about/company.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getCompanyInfo = asyncHandler(async (req, res) => {
    const company = await companyService.getCompanyInfo();
    return sendSuccess(res, 'Company information fetched successfully', { company });
});

const updateCompanyInfo = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.files) {
        const existing = await companyService.getCompanyInfo();

        if (req.files.heroImage) {
            if (existing.heroImage && existing.heroImage.fileName) {
                await deleteUploadedFile(existing.heroImage.fileName);
            }
            data.heroImage = buildFileResult(req.files.heroImage[0]);
        }

        if (req.files.aboutImage) {
            if (existing.aboutImage && existing.aboutImage.fileName) {
                await deleteUploadedFile(existing.aboutImage.fileName);
            }
            data.aboutImage = buildFileResult(req.files.aboutImage[0]);
        }
    }

    const company = await companyService.updateCompanyInfo(data);
    return sendSuccess(res, 'Company information updated successfully', { company });
});

module.exports = { getCompanyInfo, updateCompanyInfo };
