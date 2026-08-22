const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

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

const canManage = authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR);
const canRead = authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER);
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER);

const categoryUpload = createUpload({ folder: 'products/categories', fileTypes: 'images' });
const productUpload = createUpload({ folder: 'products', fileTypes: 'images' });
const featureUpload = createUpload({ folder: 'products/features', fileTypes: 'images' });
const seoUpload = createUpload({ folder: 'products/seo', fileTypes: 'images' });

// ── Product Categories ────────────────────────────────────────────────────────

router.get('/categories', auth, canRead, categoryController.getAllCategories);
router.get('/categories/:id', auth, canRead, categoryController.getCategoryById);

router.post(
    '/categories',
    auth, canManage,
    categoryUpload.fields([{ name: 'bannerImage', maxCount: 1 }, { name: 'icon', maxCount: 1 }]),
    createCategoryValidation, validate,
    categoryController.createCategory
);

router.put(
    '/categories/:id',
    auth, canEdit, blockProtectedFields,
    categoryUpload.fields([{ name: 'bannerImage', maxCount: 1 }, { name: 'icon', maxCount: 1 }]),
    updateCategoryValidation, validate,
    categoryController.updateCategory
);

router.delete('/categories/:id', auth, canManage, categoryController.deleteCategory);

// reorder BEFORE :id/status to avoid param clash
router.patch(
    '/categories/reorder',
    auth, canManage,
    categoryReorderValidation, validate,
    categoryController.reorderCategories
);

router.patch('/categories/:id/status', auth, canManage, categoryController.toggleStatus);

// ── Products ──────────────────────────────────────────────────────────────────

router.get('/', auth, canRead, productController.getAllProducts);
router.get('/:id', auth, canRead, productController.getProductById);

router.post(
    '/',
    auth, canManage,
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
    auth, canEdit, blockProtectedFields,
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

router.delete('/:id', auth, canManage, productController.deleteProduct);

// reorder BEFORE :id/status
router.patch('/reorder', auth, canManage, productReorderValidation, validate, productController.reorderProducts);
router.patch('/:id/status', auth, canManage, productController.toggleStatus);

// ── Features ──────────────────────────────────────────────────────────────────

router.get('/:productId/features', auth, canRead, sectionsController.getFeatures);

router.post(
    '/:productId/features',
    auth, canManage,
    featureUpload.single('icon'),
    createFeatureValidation, validate,
    sectionsController.createFeature
);

// reorder BEFORE /features/:id
router.patch('/features/reorder', auth, canManage, sectionReorderValidation, validate, sectionsController.reorderFeatures);

router.put(
    '/features/:id',
    auth, canEdit, blockProtectedFields,
    featureUpload.single('icon'),
    updateFeatureValidation, validate,
    sectionsController.updateFeature
);

router.delete('/features/:id', auth, canManage, sectionsController.deleteFeature);

// ── Eligibility ───────────────────────────────────────────────────────────────

router.get('/:productId/eligibility', auth, canRead, sectionsController.getEligibility);
router.post('/:productId/eligibility', auth, canManage, createEligibilityValidation, validate, sectionsController.createEligibility);
router.patch('/eligibility/reorder', auth, canManage, sectionReorderValidation, validate, sectionsController.reorderEligibility);
router.put('/eligibility/:id', auth, canEdit, blockProtectedFields, updateEligibilityValidation, validate, sectionsController.updateEligibility);
router.delete('/eligibility/:id', auth, canManage, sectionsController.deleteEligibility);

// ── Documents ─────────────────────────────────────────────────────────────────

router.get('/:productId/documents', auth, canRead, sectionsController.getDocuments);
router.post('/:productId/documents', auth, canManage, createDocumentValidation, validate, sectionsController.createDocument);
router.patch('/documents/reorder', auth, canManage, sectionReorderValidation, validate, sectionsController.reorderDocuments);
router.put('/documents/:id', auth, canEdit, blockProtectedFields, updateDocumentValidation, validate, sectionsController.updateDocument);
router.delete('/documents/:id', auth, canManage, sectionsController.deleteDocument);

// ── Interest Rates ────────────────────────────────────────────────────────────

router.get('/:productId/interest-rates', auth, canRead, sectionsController.getInterestRates);
router.post('/:productId/interest-rates', auth, canManage, createInterestRateValidation, validate, sectionsController.createInterestRate);
router.patch('/interest-rates/reorder', auth, canManage, sectionReorderValidation, validate, sectionsController.reorderInterestRates);
router.put('/interest-rates/:id', auth, canEdit, blockProtectedFields, updateInterestRateValidation, validate, sectionsController.updateInterestRate);
router.delete('/interest-rates/:id', auth, canManage, sectionsController.deleteInterestRate);

// ── FAQs ──────────────────────────────────────────────────────────────────────

router.get('/:productId/faqs', auth, canRead, sectionsController.getFaqs);
router.post('/:productId/faqs', auth, canManage, createFaqValidation, validate, sectionsController.createFaq);
router.patch('/faqs/reorder', auth, canManage, sectionReorderValidation, validate, sectionsController.reorderFaqs);
router.put('/faqs/:id', auth, canEdit, blockProtectedFields, updateFaqValidation, validate, sectionsController.updateFaq);
router.delete('/faqs/:id', auth, canManage, sectionsController.deleteFaq);

// ── EMI Config ────────────────────────────────────────────────────────────────

router.get('/:productId/emi', auth, canRead, sectionsController.getEmiConfig);
router.put('/:productId/emi', auth, canEdit, blockProtectedFields, updateEmiConfigValidation, validate, sectionsController.updateEmiConfig);

// ── SEO ───────────────────────────────────────────────────────────────────────

router.get('/:productId/seo', auth, canRead, sectionsController.getSeo);
router.put(
    '/:productId/seo',
    auth, canEdit, blockProtectedFields,
    seoUpload.single('ogImage'),
    updateSeoValidation, validate,
    sectionsController.updateSeo
);

module.exports = router;
