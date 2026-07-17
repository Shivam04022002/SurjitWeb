const Product = require('../../models/Product');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// ── Generic helpers ───────────────────────────────────────────────────────────

const getProduct = async (productId) => {
    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
    }
    return product;
};

const getSubDoc = (arr, id) => {
    const item = arr.id(id);
    if (!item) throw new AppError('Item not found', HTTP_STATUS.NOT_FOUND);
    return item;
};

const findProductBySubDocId = async (arrayField, subDocId) => {
    const product = await Product.findOne({ [`${arrayField}._id`]: subDocId });
    if (!product) throw new AppError('Item not found', HTTP_STATUS.NOT_FOUND);
    return product;
};

// ── Features ──────────────────────────────────────────────────────────────────

const getFeatures = async (productId) => {
    const product = await getProduct(productId);
    return product.features.sort((a, b) => a.displayOrder - b.displayOrder);
};

const createFeature = async (productId, data) => {
    const product = await getProduct(productId);
    product.features.push(data);
    await product.save();
    return product.features[product.features.length - 1];
};

const updateFeature = async (productId, featureId, data) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('features', featureId);
    const feature = getSubDoc(product.features, featureId);
    Object.assign(feature, data);
    await product.save();
    return feature;
};

const deleteFeature = async (productId, featureId) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('features', featureId);
    const feature = getSubDoc(product.features, featureId);
    feature.deleteOne();
    await product.save();
    return feature;
};

const reorderFeatures = async (productId, orderedIds) => {
    const product = await getProduct(productId);
    orderedIds.forEach((id, index) => {
        const item = product.features.id(id);
        if (item) item.displayOrder = index + 1;
    });
    await product.save();
    return product.features.sort((a, b) => a.displayOrder - b.displayOrder);
};

// ── Eligibility ───────────────────────────────────────────────────────────────

const getEligibility = async (productId) => {
    const product = await getProduct(productId);
    return product.eligibility.sort((a, b) => a.displayOrder - b.displayOrder);
};

const createEligibility = async (productId, data) => {
    const product = await getProduct(productId);
    product.eligibility.push(data);
    await product.save();
    return product.eligibility[product.eligibility.length - 1];
};

const updateEligibility = async (productId, eligibilityId, data) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('eligibility', eligibilityId);
    const item = getSubDoc(product.eligibility, eligibilityId);
    Object.assign(item, data);
    await product.save();
    return item;
};

const deleteEligibility = async (productId, eligibilityId) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('eligibility', eligibilityId);
    const item = getSubDoc(product.eligibility, eligibilityId);
    item.deleteOne();
    await product.save();
};

const reorderEligibility = async (productId, orderedIds) => {
    const product = await getProduct(productId);
    orderedIds.forEach((id, index) => {
        const item = product.eligibility.id(id);
        if (item) item.displayOrder = index + 1;
    });
    await product.save();
    return product.eligibility.sort((a, b) => a.displayOrder - b.displayOrder);
};

// ── Documents ─────────────────────────────────────────────────────────────────

const getDocuments = async (productId) => {
    const product = await getProduct(productId);
    return product.documents.sort((a, b) => a.displayOrder - b.displayOrder);
};

const createDocument = async (productId, data) => {
    const product = await getProduct(productId);
    product.documents.push(data);
    await product.save();
    return product.documents[product.documents.length - 1];
};

const updateDocument = async (productId, documentId, data) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('documents', documentId);
    const item = getSubDoc(product.documents, documentId);
    Object.assign(item, data);
    await product.save();
    return item;
};

const deleteDocument = async (productId, documentId) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('documents', documentId);
    const item = getSubDoc(product.documents, documentId);
    item.deleteOne();
    await product.save();
};

const reorderDocuments = async (productId, orderedIds) => {
    const product = await getProduct(productId);
    orderedIds.forEach((id, index) => {
        const item = product.documents.id(id);
        if (item) item.displayOrder = index + 1;
    });
    await product.save();
    return product.documents.sort((a, b) => a.displayOrder - b.displayOrder);
};

// ── Interest Rates ────────────────────────────────────────────────────────────

const getInterestRates = async (productId) => {
    const product = await getProduct(productId);
    return product.interestRates.sort((a, b) => a.displayOrder - b.displayOrder);
};

const createInterestRate = async (productId, data) => {
    const product = await getProduct(productId);
    product.interestRates.push(data);
    await product.save();
    return product.interestRates[product.interestRates.length - 1];
};

const updateInterestRate = async (productId, rateId, data) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('interestRates', rateId);
    const item = getSubDoc(product.interestRates, rateId);
    Object.assign(item, data);
    await product.save();
    return item;
};

const deleteInterestRate = async (productId, rateId) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('interestRates', rateId);
    const item = getSubDoc(product.interestRates, rateId);
    item.deleteOne();
    await product.save();
};

const reorderInterestRates = async (productId, orderedIds) => {
    const product = await getProduct(productId);
    orderedIds.forEach((id, index) => {
        const item = product.interestRates.id(id);
        if (item) item.displayOrder = index + 1;
    });
    await product.save();
    return product.interestRates.sort((a, b) => a.displayOrder - b.displayOrder);
};

// ── FAQs ──────────────────────────────────────────────────────────────────────

const getFaqs = async (productId) => {
    const product = await getProduct(productId);
    return product.faqs.sort((a, b) => a.displayOrder - b.displayOrder);
};

const createFaq = async (productId, data) => {
    const product = await getProduct(productId);
    product.faqs.push(data);
    await product.save();
    return product.faqs[product.faqs.length - 1];
};

const updateFaq = async (productId, faqId, data) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('faqs', faqId);
    const item = getSubDoc(product.faqs, faqId);
    Object.assign(item, data);
    await product.save();
    return item;
};

const deleteFaq = async (productId, faqId) => {
    const product = productId ? await getProduct(productId) : await findProductBySubDocId('faqs', faqId);
    const item = getSubDoc(product.faqs, faqId);
    item.deleteOne();
    await product.save();
};

const reorderFaqs = async (productId, orderedIds) => {
    const product = await getProduct(productId);
    orderedIds.forEach((id, index) => {
        const item = product.faqs.id(id);
        if (item) item.displayOrder = index + 1;
    });
    await product.save();
    return product.faqs.sort((a, b) => a.displayOrder - b.displayOrder);
};

// ── EMI Config ────────────────────────────────────────────────────────────────

const getEmiConfig = async (productId) => {
    const product = await getProduct(productId);
    return product.emiConfig;
};

const updateEmiConfig = async (productId, data) => {
    const product = await getProduct(productId);
    Object.assign(product.emiConfig, data);
    await product.save();
    return product.emiConfig;
};

// ── SEO ───────────────────────────────────────────────────────────────────────

const getSeo = async (productId) => {
    const product = await getProduct(productId);
    return product.seo;
};

const updateSeo = async (productId, data) => {
    const product = await getProduct(productId);
    Object.assign(product.seo, data);
    await product.save();
    return product.seo;
};

module.exports = {
    findProductBySubDocId,
    getFeatures, createFeature, updateFeature, deleteFeature, reorderFeatures,
    getEligibility, createEligibility, updateEligibility, deleteEligibility, reorderEligibility,
    getDocuments, createDocument, updateDocument, deleteDocument, reorderDocuments,
    getInterestRates, createInterestRate, updateInterestRate, deleteInterestRate, reorderInterestRates,
    getFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs,
    getEmiConfig, updateEmiConfig,
    getSeo, updateSeo
};
