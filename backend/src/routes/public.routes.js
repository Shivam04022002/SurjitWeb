const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const settingsService = require('../services/settings.service');
const companyService = require('../services/about/company.service');
const directorService = require('../services/about/director.service');
const leadershipService = require('../services/about/leadership.service');
const productCategoryService = require('../services/products/category.service');
const productService = require('../services/products/product.service');
const sectionsService = require('../services/products/sections.service');
const careerSettingsService = require('../services/career/settings.service');
const jobsService = require('../services/career/jobs.service');
const albumsService = require('../services/gallery/albums.service');
const imagesService = require('../services/gallery/images.service');

const Product = require('../models/Product');

const router = express.Router();

// ── Global Settings ────────────────────────────────────────────────────────────
router.get('/settings', asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings();
    return sendSuccess(res, 'Settings fetched successfully', { settings });
}));

// ── About ──────────────────────────────────────────────────────────────────────
router.get('/about/company', asyncHandler(async (req, res) => {
    const company = await companyService.getCompanyInfo();
    return sendSuccess(res, 'Company info fetched successfully', { company });
}));

router.get('/about/directors', asyncHandler(async (req, res) => {
    const directors = await directorService.getAllDirectors();
    return sendSuccess(res, 'Directors fetched successfully', { directors });
}));

router.get('/about/leadership', asyncHandler(async (req, res) => {
    const members = await leadershipService.getAllLeadershipMembers();
    return sendSuccess(res, 'Leadership team fetched successfully', { members });
}));

// ── Product Categories (category-based navigation) ─────────────────────────────
// Drives the header dropdown and the /products landing page: active categories
// only, ordered by displayOrder.
router.get('/product-categories', asyncHandler(async (req, res) => {
    const categories = await productCategoryService.getActiveCategories();
    return sendSuccess(res, 'Product categories fetched successfully', { categories });
}));

// Drives /products/:categorySlug. Returns the category and its products together
// so the page renders from a single round trip.
router.get('/product-categories/:slug/products', asyncHandler(async (req, res) => {
    const category = await productCategoryService.getActiveCategoryBySlug(req.params.slug);
    const products = await productService.getActiveProductsByCategory(category._id);
    return sendSuccess(res, 'Category products fetched successfully', { category, products });
}));

// ── Products ───────────────────────────────────────────────────────────────────
// Retained as-is: still returns every category (active or not) for existing callers.
router.get('/products/categories', asyncHandler(async (req, res) => {
    const categories = await productCategoryService.getAllCategories();
    return sendSuccess(res, 'Categories fetched successfully', { categories });
}));

router.get('/products', asyncHandler(async (req, res) => {
    const products = await productService.getAllProducts();
    return sendSuccess(res, 'Products fetched successfully', { products });
}));

// Get product by slug (for the public website)
router.get('/products/by-slug/:slug', asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug');
    if (!product) {
        const { AppError } = require('../middleware/errorHandler');
        throw new AppError('Product not found', 404);
    }
    return sendSuccess(res, 'Product fetched successfully', { product });
}));

router.get('/products/:productId/features', asyncHandler(async (req, res) => {
    const features = await sectionsService.getFeatures(req.params.productId);
    return sendSuccess(res, 'Features fetched successfully', { features });
}));

router.get('/products/:productId/eligibility', asyncHandler(async (req, res) => {
    const eligibility = await sectionsService.getEligibility(req.params.productId);
    return sendSuccess(res, 'Eligibility fetched successfully', { eligibility });
}));

router.get('/products/:productId/documents', asyncHandler(async (req, res) => {
    const documents = await sectionsService.getDocuments(req.params.productId);
    return sendSuccess(res, 'Documents fetched successfully', { documents });
}));

router.get('/products/:productId/interest-rates', asyncHandler(async (req, res) => {
    const rates = await sectionsService.getInterestRates(req.params.productId);
    return sendSuccess(res, 'Interest rates fetched successfully', { rates });
}));

router.get('/products/:productId/faqs', asyncHandler(async (req, res) => {
    const faqs = await sectionsService.getFaqs(req.params.productId);
    return sendSuccess(res, 'FAQs fetched successfully', { faqs });
}));

router.get('/products/:productId/emi', asyncHandler(async (req, res) => {
    const emi = await sectionsService.getEmiConfig(req.params.productId);
    return sendSuccess(res, 'EMI config fetched successfully', { emi });
}));

router.get('/products/:productId/seo', asyncHandler(async (req, res) => {
    const seo = await sectionsService.getSeo(req.params.productId);
    return sendSuccess(res, 'SEO fetched successfully', { seo });
}));

// ── Career ─────────────────────────────────────────────────────────────────────
router.get('/careers/settings', asyncHandler(async (req, res) => {
    const settings = await careerSettingsService.getSettings();
    return sendSuccess(res, 'Career settings fetched successfully', { settings });
}));

router.get('/careers/jobs', asyncHandler(async (req, res) => {
    const jobs = await jobsService.getAllJobs({ isPublished: true, isActive: true });
    return sendSuccess(res, 'Jobs fetched successfully', { jobs });
}));

router.get('/careers/jobs/:id', asyncHandler(async (req, res) => {
    const job = await jobsService.getJobById(req.params.id);
    return sendSuccess(res, 'Job fetched successfully', { job });
}));

// ── Gallery ────────────────────────────────────────────────────────────────────
router.get('/gallery/albums', asyncHandler(async (req, res) => {
    const albums = await albumsService.getAllAlbums({ isActive: true });
    return sendSuccess(res, 'Albums fetched successfully', { albums });
}));

router.get('/gallery/albums/:id', asyncHandler(async (req, res) => {
    const album = await albumsService.getAlbumById(req.params.id);
    return sendSuccess(res, 'Album fetched successfully', { album });
}));

router.get('/gallery/albums/:albumId/images', asyncHandler(async (req, res) => {
    const images = await imagesService.getImagesByAlbum(req.params.albumId, { isActive: true });
    return sendSuccess(res, 'Images fetched successfully', { images });
}));

module.exports = router;
