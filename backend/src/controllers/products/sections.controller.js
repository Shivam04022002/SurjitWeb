const sectionsService = require('../../services/products/sections.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

// ── Features ──────────────────────────────────────────────────────────────────

const getFeatures = asyncHandler(async (req, res) => {
    const features = await sectionsService.getFeatures(req.params.productId);
    return sendSuccess(res, 'Features fetched successfully', { features });
});

const createFeature = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (req.file) {
        data.icon = buildFileResult(req.file);
    }
    const feature = await sectionsService.createFeature(req.params.productId, data);
    return sendSuccess(res, 'Feature created successfully', { feature }, HTTP_STATUS.CREATED);
});

const updateFeature = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const id = req.params.id;
    const data = { ...req.body };
    if (req.file) {
        const existing = await sectionsService.findProductBySubDocId('features', id);
        const existingFeature = existing.features.id(id);
        if (existingFeature && existingFeature.icon && existingFeature.icon.fileName) {
            await deleteUploadedFile(existingFeature.icon.fileName);
        }
        data.icon = buildFileResult(req.file);
    }
    const feature = await sectionsService.updateFeature(productId, id, data);
    return sendSuccess(res, 'Feature updated successfully', { feature });
});

const deleteFeature = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const id = req.params.id;
    const deleted = await sectionsService.deleteFeature(productId, id);
    if (deleted && deleted.icon && deleted.icon.fileName) {
        await deleteUploadedFile(deleted.icon.fileName);
    }
    return sendSuccess(res, 'Feature deleted successfully', {});
});

const reorderFeatures = asyncHandler(async (req, res) => {
    const { ids, productId: bodyProductId } = req.body;
    const productId = req.params.productId || bodyProductId;
    const features = await sectionsService.reorderFeatures(productId, ids);
    return sendSuccess(res, 'Features reordered successfully', { features });
});

// ── Eligibility ───────────────────────────────────────────────────────────────

const getEligibility = asyncHandler(async (req, res) => {
    const eligibility = await sectionsService.getEligibility(req.params.productId);
    return sendSuccess(res, 'Eligibility fetched successfully', { eligibility });
});

const createEligibility = asyncHandler(async (req, res) => {
    const item = await sectionsService.createEligibility(req.params.productId, req.body);
    return sendSuccess(res, 'Eligibility item created successfully', { eligibility: item }, HTTP_STATUS.CREATED);
});

const updateEligibility = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const item = await sectionsService.updateEligibility(productId, req.params.id, req.body);
    return sendSuccess(res, 'Eligibility item updated successfully', { eligibility: item });
});

const deleteEligibility = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    await sectionsService.deleteEligibility(productId, req.params.id);
    return sendSuccess(res, 'Eligibility item deleted successfully', {});
});

const reorderEligibility = asyncHandler(async (req, res) => {
    const { ids, productId: bodyProductId } = req.body;
    const productId = req.params.productId || bodyProductId;
    const eligibility = await sectionsService.reorderEligibility(productId, ids);
    return sendSuccess(res, 'Eligibility reordered successfully', { eligibility });
});

// ── Documents ─────────────────────────────────────────────────────────────────

const getDocuments = asyncHandler(async (req, res) => {
    const documents = await sectionsService.getDocuments(req.params.productId);
    return sendSuccess(res, 'Documents fetched successfully', { documents });
});

const createDocument = asyncHandler(async (req, res) => {
    const item = await sectionsService.createDocument(req.params.productId, req.body);
    return sendSuccess(res, 'Document created successfully', { document: item }, HTTP_STATUS.CREATED);
});

const updateDocument = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const item = await sectionsService.updateDocument(productId, req.params.id, req.body);
    return sendSuccess(res, 'Document updated successfully', { document: item });
});

const deleteDocument = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    await sectionsService.deleteDocument(productId, req.params.id);
    return sendSuccess(res, 'Document deleted successfully', {});
});

const reorderDocuments = asyncHandler(async (req, res) => {
    const { ids, productId: bodyProductId } = req.body;
    const productId = req.params.productId || bodyProductId;
    const documents = await sectionsService.reorderDocuments(productId, ids);
    return sendSuccess(res, 'Documents reordered successfully', { documents });
});

// ── Interest Rates ────────────────────────────────────────────────────────────

const getInterestRates = asyncHandler(async (req, res) => {
    const interestRates = await sectionsService.getInterestRates(req.params.productId);
    return sendSuccess(res, 'Interest rates fetched successfully', { interestRates });
});

const createInterestRate = asyncHandler(async (req, res) => {
    const item = await sectionsService.createInterestRate(req.params.productId, req.body);
    return sendSuccess(res, 'Interest rate created successfully', { interestRate: item }, HTTP_STATUS.CREATED);
});

const updateInterestRate = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const item = await sectionsService.updateInterestRate(productId, req.params.id, req.body);
    return sendSuccess(res, 'Interest rate updated successfully', { interestRate: item });
});

const deleteInterestRate = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    await sectionsService.deleteInterestRate(productId, req.params.id);
    return sendSuccess(res, 'Interest rate deleted successfully', {});
});

const reorderInterestRates = asyncHandler(async (req, res) => {
    const { ids, productId: bodyProductId } = req.body;
    const productId = req.params.productId || bodyProductId;
    const interestRates = await sectionsService.reorderInterestRates(productId, ids);
    return sendSuccess(res, 'Interest rates reordered successfully', { interestRates });
});

// ── FAQs ──────────────────────────────────────────────────────────────────────

const getFaqs = asyncHandler(async (req, res) => {
    const faqs = await sectionsService.getFaqs(req.params.productId);
    return sendSuccess(res, 'FAQs fetched successfully', { faqs });
});

const createFaq = asyncHandler(async (req, res) => {
    const item = await sectionsService.createFaq(req.params.productId, req.body);
    return sendSuccess(res, 'FAQ created successfully', { faq: item }, HTTP_STATUS.CREATED);
});

const updateFaq = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    const item = await sectionsService.updateFaq(productId, req.params.id, req.body);
    return sendSuccess(res, 'FAQ updated successfully', { faq: item });
});

const deleteFaq = asyncHandler(async (req, res) => {
    const productId = req.params.productId || null;
    await sectionsService.deleteFaq(productId, req.params.id);
    return sendSuccess(res, 'FAQ deleted successfully', {});
});

const reorderFaqs = asyncHandler(async (req, res) => {
    const { ids, productId: bodyProductId } = req.body;
    const productId = req.params.productId || bodyProductId;
    const faqs = await sectionsService.reorderFaqs(productId, ids);
    return sendSuccess(res, 'FAQs reordered successfully', { faqs });
});

// ── EMI Config ────────────────────────────────────────────────────────────────

const getEmiConfig = asyncHandler(async (req, res) => {
    const emiConfig = await sectionsService.getEmiConfig(req.params.productId);
    return sendSuccess(res, 'EMI config fetched successfully', { emiConfig });
});

const updateEmiConfig = asyncHandler(async (req, res) => {
    const emiConfig = await sectionsService.updateEmiConfig(req.params.productId, req.body);
    return sendSuccess(res, 'EMI config updated successfully', { emiConfig });
});

// ── SEO ───────────────────────────────────────────────────────────────────────

const getSeo = asyncHandler(async (req, res) => {
    const seo = await sectionsService.getSeo(req.params.productId);
    return sendSuccess(res, 'SEO data fetched successfully', { seo });
});

const updateSeo = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const data = { ...req.body };

    if (req.file) {
        const existing = await sectionsService.getSeo(productId);
        if (existing && existing.ogImage && existing.ogImage.fileName) {
            await deleteUploadedFile(existing.ogImage.fileName);
        }
        data.ogImage = buildFileResult(req.file);
    }

    const seo = await sectionsService.updateSeo(productId, data);
    return sendSuccess(res, 'SEO data updated successfully', { seo });
});

module.exports = {
    getFeatures, createFeature, updateFeature, deleteFeature, reorderFeatures,
    getEligibility, createEligibility, updateEligibility, deleteEligibility, reorderEligibility,
    getDocuments, createDocument, updateDocument, deleteDocument, reorderDocuments,
    getInterestRates, createInterestRate, updateInterestRate, deleteInterestRate, reorderInterestRates,
    getFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs,
    getEmiConfig, updateEmiConfig,
    getSeo, updateSeo
};
