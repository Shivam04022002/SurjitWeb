const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

const blogsController = require('../controllers/blog/blogs.controller');
const categoriesController = require('../controllers/blog/categories.controller');

const { createBlogValidation, updateBlogValidation } = require('../validators/blog/blogs.validator');
const { createCategoryValidation, updateCategoryValidation } = require('../validators/blog/categories.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// Reuses the shared upload middleware, so blog images land in S3 (or local
// disk) on the same path every other module uses.
const blogUpload = createUpload({ folder: 'blog', fileTypes: 'images' }).fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'seo.ogImage', maxCount: 1 },
    { name: 'ogImage', maxCount: 1 }
]);

// Inline images dropped into the rich text editor.
const inlineUpload = createUpload({ folder: 'blog/inline', fileTypes: 'images' }).single('image');

// ── Categories ────────────────────────────────────────────────────────────────
// Declared before /:id blog routes so "categories" is never read as an id.
router.get('/categories', canRead, categoriesController.getAllCategories);
router.get('/categories/:id', canRead, categoriesController.getCategoryById);
router.post('/categories', canManage, createCategoryValidation, validate, categoriesController.createCategory);
router.put('/categories/:id', canManage, updateCategoryValidation, validate, categoriesController.updateCategory);
router.delete('/categories/:id', superAdminOnly, categoriesController.deleteCategory);
router.patch('/categories/:id/status', canManage, categoriesController.toggleCategoryStatus);

// ── Inline editor uploads ─────────────────────────────────────────────────────
router.post('/uploads/inline', canManage, inlineUpload, (req, res) => {
    const { buildFileResult } = require('../services/upload.service');
    const { sendSuccess } = require('../utils/response');
    if (!req.file) {
        const { AppError } = require('../middleware/errorHandler');
        const HTTP_STATUS = require('../constants/httpStatus');
        throw new AppError('An image file is required', HTTP_STATUS.BAD_REQUEST);
    }
    return sendSuccess(res, 'Image uploaded successfully', { image: buildFileResult(req.file) });
});

// ── Blogs ─────────────────────────────────────────────────────────────────────
router.get('/', canRead, blogsController.listBlogs);
router.get('/:id', canRead, blogsController.getBlogById);
router.post('/', canManage, blogUpload, createBlogValidation, validate, blogsController.createBlog);
router.put('/:id', canManage, blogUpload, updateBlogValidation, validate, blogsController.updateBlog);
router.delete('/:id', superAdminOnly, blogsController.deleteBlog);
router.patch('/:id/publish', canManage, blogsController.publishBlog);
router.patch('/:id/unpublish', canManage, blogsController.unpublishBlog);
router.post('/:id/duplicate', canManage, blogsController.duplicateBlog);

module.exports = router;
