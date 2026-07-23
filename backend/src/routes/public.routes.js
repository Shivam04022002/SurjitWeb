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
const blogsService = require('../services/blog/blogs.service');
const blogCategoriesService = require('../services/blog/categories.service');
const reviewController = require('../controllers/review.controller');
const reportController = require('../controllers/report.controller');
const branchController = require('../controllers/branch.controller');
const homepageStatController = require('../controllers/homepageStat.controller');
const legalPageController = require('../controllers/legalPage.controller');
const nodalOfficerController = require('../controllers/nodalOfficer.controller');
const { createUpload } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { reviewSubmissionLimiter } = require('../middleware/rateLimiters');
const { submitReviewValidation } = require('../validators/review.validator');

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

// ── Product Categories ─────────────────────────────────────────────────────────
// Active categories, ordered by displayOrder. Drives the header dropdown.
router.get('/product-categories', asyncHandler(async (req, res) => {
    const categories = await productCategoryService.getActiveCategories();
    return sendSuccess(res, 'Product categories fetched successfully', { categories });
}));

// A category and its active products, ordered by displayOrder, in one round
// trip. Backs the product slider, and the frontend reads products[0] from here
// to resolve a category link to a product.
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

// ── Blogs ──────────────────────────────────────────────────────────────────────
// Published posts only, newest first, paginated. Backs the listing page and
// its search / category filters.
router.get('/blogs', asyncHandler(async (req, res) => {
    const result = await blogsService.listBlogs({
        ...req.query,
        status: 'published',
        sortBy: 'publishedAt',
        sortOrder: 'desc'
    });
    return sendSuccess(res, 'Blogs fetched successfully', result);
}));

router.get('/blogs/categories', asyncHandler(async (req, res) => {
    const categories = await blogCategoriesService.getAllCategories({ isActive: true });
    return sendSuccess(res, 'Blog categories fetched successfully', { categories });
}));

router.get('/blogs/:slug', asyncHandler(async (req, res) => {
    const blog = await blogsService.getPublishedBlogBySlug(req.params.slug);
    return sendSuccess(res, 'Blog fetched successfully', { blog });
}));

router.get('/blogs/:slug/related', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 12);
    const blogs = await blogsService.getRelatedBlogs(req.params.slug, limit);
    return sendSuccess(res, 'Related blogs fetched successfully', { blogs });
}));

router.get('/blogs/:slug/adjacent', asyncHandler(async (req, res) => {
    const adjacent = await blogsService.getAdjacentBlogs(req.params.slug);
    return sendSuccess(res, 'Adjacent blogs fetched successfully', adjacent);
}));

// ── Customer reviews ───────────────────────────────────────────────────────────
// Approved reviews only, ordered by displayOrder. `limit` returns a plain array
// for the blog sidebar; passing `page` returns the paginated envelope so a
// dedicated reviews page can page through them. Mobile and email are never
// included in the response.
router.get('/reviews', reviewController.listPublicReviews);

// Customer submission. Photos go through the shared upload middleware, and the
// dedicated limiter keeps an unauthenticated write that accepts a file from
// being worth abusing — the general API limiter is far too permissive for this.
// Every submission is created Pending; the status cannot be set by the client.
const reviewPhotoUpload = createUpload({ folder: 'reviews', fileTypes: 'images' }).single('photo');

router.post(
    '/reviews',
    reviewSubmissionLimiter,
    reviewPhotoUpload,
    submitReviewValidation,
    validate,
    reviewController.submitReview
);

// ── Annual reports ─────────────────────────────────────────────────────────────
// Published reports only, ordered by displayOrder then newest.
router.get('/reports', reportController.listPublicReports);

// Streams the PDF back as an attachment. Needed because the file lives on S3 in
// production, and a browser ignores <a download> across origins.
router.get('/reports/:id/download', reportController.downloadReport);

// ── Branches ───────────────────────────────────────────────────────────────────
// Published branches only, in display order. Backs "Our Branches" on Contact.
router.get('/branches', branchController.listPublicBranches);

// ── Homepage statistics ────────────────────────────────────────────────────────
// Published stats only, in display order. Backs the counter strip in the Hero.
router.get('/homepage-stats', homepageStatController.listPublicStats);

// ── Legal pages ────────────────────────────────────────────────────────────────
// Published legal pages. The list carries only metadata; a single page is
// fetched by slug, and its optional document served via /download.
router.get('/legal-pages', legalPageController.listPublicPages);
router.get('/legal-pages/:slug', legalPageController.getPublicPageBySlug);
router.get('/legal-pages/:slug/download', legalPageController.downloadPage);

// ── Nodal officers ─────────────────────────────────────────────────────────────
// Published officers only, in display order. Backs the /nodal-officer page.
router.get('/nodal-officers', nodalOfficerController.listPublicOfficers);

module.exports = router;
