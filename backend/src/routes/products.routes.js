const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');

const categoryController = require('../controllers/products/category.controller');
const productController = require('../controllers/products/product.controller');
const sectionsController = require('../controllers/products/sections.controller');

const {
    createCategoryValidation,
    updateCategoryValidation,
    reorderValidation: categoryReorderValidation
} = require('../validators/products/category.validator');

const {
    createProductValidation,
    updateProductValidation,
    reorderValidation: productReorderValidation
} = require('../validators/products/product.validator');

const {
    createFeatureValidation, updateFeatureValidation,
    createEligibilityValidation, updateEligibilityValidation,
    createDocumentValidation, updateDocumentValidation,
    createInterestRateValidation, updateInterestRateValidation,
    createFaqValidation, updateFaqValidation,
    updateEmiConfigValidation, updateSeoValidation,
    reorderValidation: sectionReorderValidation
} = require('../validators/products/sections.validator');

const router = express.Router();

// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.

const categoryUpload = createUpload({ folder: 'products/categories', fileTypes: 'images' });
const productUpload = createUpload({ folder: 'products', fileTypes: 'images' });
const featureUpload = createUpload({ folder: 'products/features', fileTypes: 'images' });
const seoUpload = createUpload({ folder: 'products/seo', fileTypes: 'images' });

// ── Product Categories ────────────────────────────────────────────────────────

router.get('/categories', auth, viewPage('productCategories'), categoryController.getAllCategories);
router.get('/categories/:id', auth, viewPage('productCategories'), categoryController.getCategoryById);

router.post(
    '/categories',
    auth, editPage('productCategories'),
    categoryUpload.fields([{ name: 'bannerImage', maxCount: 1 }, { name: 'icon', maxCount: 1 }]),
    createCategoryValidation, validate,
    categoryController.createCategory
);

router.put(
    '/categories/:id',
    auth, editPage('productCategories'), blockProtectedFields,
    categoryUpload.fields([{ name: 'bannerImage', maxCount: 1 }, { name: 'icon', maxCount: 1 }]),
    updateCategoryValidation, validate,
    categoryController.updateCategory
);

router.delete('/categories/:id', auth, editPage('productCategories'), categoryController.deleteCategory);

// reorder BEFORE :id/status to avoid param clash
router.patch(
    '/categories/reorder',
    auth, editPage('productCategories'),
    categoryReorderValidation, validate,
    categoryController.reorderCategories
);

router.patch('/categories/:id/status', auth, editPage('productCategories'), categoryController.toggleStatus);

// ── Products ──────────────────────────────────────────────────────────────────

router.get('/', auth, viewPage('products'), productController.getAllProducts);
router.get('/:id', auth, viewPage('products'), productController.getProductById);

router.post(
    '/',
    auth, editPage('products'),
    // bannerImage is no longer accepted: the public site has no banner slot
    // since the hero image became the hero background. The field stays on the
    // Product schema so existing uploads keep resolving and stay recoverable.
    productUpload.fields([
        { name: 'heroImage', maxCount: 1 },
        { name: 'thumbnailImage', maxCount: 1 }
    ]),
    createProductValidation, validate,
    productController.createProduct
);

router.put(
    '/:id',
    auth, editPage('products'), blockProtectedFields,
    // bannerImage is no longer accepted: the public site has no banner slot
    // since the hero image became the hero background. The field stays on the
    // Product schema so existing uploads keep resolving and stay recoverable.
    productUpload.fields([
        { name: 'heroImage', maxCount: 1 },
        { name: 'thumbnailImage', maxCount: 1 }
    ]),
    updateProductValidation, validate,
    productController.updateProduct
);

router.delete('/:id', auth, editPage('products'), productController.deleteProduct);

// reorder BEFORE :id/status
router.patch('/reorder', auth, editPage('products'), productReorderValidation, validate, productController.reorderProducts);
router.patch('/:id/status', auth, editPage('products'), productController.toggleStatus);

// ── Features ──────────────────────────────────────────────────────────────────

router.get('/:productId/features', auth, viewPage('products'), sectionsController.getFeatures);

router.post(
    '/:productId/features',
    auth, editPage('products'),
    featureUpload.single('icon'),
    createFeatureValidation, validate,
    sectionsController.createFeature
);

// reorder BEFORE /features/:id
router.patch('/features/reorder', auth, editPage('products'), sectionReorderValidation, validate, sectionsController.reorderFeatures);

router.put(
    '/features/:id',
    auth, editPage('products'), blockProtectedFields,
    featureUpload.single('icon'),
    updateFeatureValidation, validate,
    sectionsController.updateFeature
);

router.delete('/features/:id', auth, editPage('products'), sectionsController.deleteFeature);

// ── Eligibility ───────────────────────────────────────────────────────────────

router.get('/:productId/eligibility', auth, viewPage('products'), sectionsController.getEligibility);
router.post('/:productId/eligibility', auth, editPage('products'), createEligibilityValidation, validate, sectionsController.createEligibility);
router.patch('/eligibility/reorder', auth, editPage('products'), sectionReorderValidation, validate, sectionsController.reorderEligibility);
router.put('/eligibility/:id', auth, editPage('products'), blockProtectedFields, updateEligibilityValidation, validate, sectionsController.updateEligibility);
router.delete('/eligibility/:id', auth, editPage('products'), sectionsController.deleteEligibility);

// ── Documents ─────────────────────────────────────────────────────────────────

router.get('/:productId/documents', auth, viewPage('products'), sectionsController.getDocuments);
router.post('/:productId/documents', auth, editPage('products'), createDocumentValidation, validate, sectionsController.createDocument);
router.patch('/documents/reorder', auth, editPage('products'), sectionReorderValidation, validate, sectionsController.reorderDocuments);
router.put('/documents/:id', auth, editPage('products'), blockProtectedFields, updateDocumentValidation, validate, sectionsController.updateDocument);
router.delete('/documents/:id', auth, editPage('products'), sectionsController.deleteDocument);

// ── Interest Rates ────────────────────────────────────────────────────────────

router.get('/:productId/interest-rates', auth, viewPage('products'), sectionsController.getInterestRates);
router.post('/:productId/interest-rates', auth, editPage('products'), createInterestRateValidation, validate, sectionsController.createInterestRate);
router.patch('/interest-rates/reorder', auth, editPage('products'), sectionReorderValidation, validate, sectionsController.reorderInterestRates);
router.put('/interest-rates/:id', auth, editPage('products'), blockProtectedFields, updateInterestRateValidation, validate, sectionsController.updateInterestRate);
router.delete('/interest-rates/:id', auth, editPage('products'), sectionsController.deleteInterestRate);

// ── FAQs ──────────────────────────────────────────────────────────────────────

router.get('/:productId/faqs', auth, viewPage('products'), sectionsController.getFaqs);
router.post('/:productId/faqs', auth, editPage('products'), createFaqValidation, validate, sectionsController.createFaq);
router.patch('/faqs/reorder', auth, editPage('products'), sectionReorderValidation, validate, sectionsController.reorderFaqs);
router.put('/faqs/:id', auth, editPage('products'), blockProtectedFields, updateFaqValidation, validate, sectionsController.updateFaq);
router.delete('/faqs/:id', auth, editPage('products'), sectionsController.deleteFaq);

// ── EMI Config ────────────────────────────────────────────────────────────────

router.get('/:productId/emi', auth, viewPage('products'), sectionsController.getEmiConfig);
router.put('/:productId/emi', auth, editPage('products'), blockProtectedFields, updateEmiConfigValidation, validate, sectionsController.updateEmiConfig);

// ── SEO ───────────────────────────────────────────────────────────────────────

router.get('/:productId/seo', auth, viewPage('products'), sectionsController.getSeo);
router.put(
    '/:productId/seo',
    auth, editPage('products'), blockProtectedFields,
    seoUpload.single('ogImage'),
    updateSeoValidation, validate,
    sectionsController.updateSeo
);

module.exports = router;
