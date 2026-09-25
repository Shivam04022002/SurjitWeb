const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');

const blogsController = require('../controllers/blog/blogs.controller');
const categoriesController = require('../controllers/blog/categories.controller');

const { createBlogValidation, updateBlogValidation } = require('../validators/blog/blogs.validator');
const { createCategoryValidation, updateCategoryValidation } = require('../validators/blog/categories.validator');

const router = express.Router();

// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.

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
router.get('/categories', [auth, viewPage('blogCategories')], categoriesController.getAllCategories);
router.get('/categories/:id', [auth, viewPage('blogCategories')], categoriesController.getCategoryById);
router.post('/categories', [auth, editPage('blogCategories')], createCategoryValidation, validate, categoriesController.createCategory);
router.put('/categories/:id', [auth, editPage('blogCategories')], blockProtectedFields, updateCategoryValidation, validate, categoriesController.updateCategory);
router.delete('/categories/:id', [auth, editPage('blogCategories')], categoriesController.deleteCategory);
router.patch('/categories/:id/status', [auth, editPage('blogCategories')], categoriesController.toggleCategoryStatus);

// ── Inline editor uploads ─────────────────────────────────────────────────────
router.post('/uploads/inline', [auth, editPage('blogs')], inlineUpload, (req, res) => {
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
router.get('/', [auth, viewPage('blogs')], blogsController.listBlogs);
router.get('/:id', [auth, viewPage('blogs')], blogsController.getBlogById);
router.post('/', [auth, editPage('blogs')], blogUpload, createBlogValidation, validate, blogsController.createBlog);
router.put('/:id', [auth, editPage('blogs')], blockProtectedFields, blogUpload, updateBlogValidation, validate, blogsController.updateBlog);
router.delete('/:id', [auth, editPage('blogs')], blogsController.deleteBlog);
router.patch('/:id/publish', [auth, editPage('blogs')], blogsController.publishBlog);
router.patch('/:id/unpublish', [auth, editPage('blogs')], blogsController.unpublishBlog);
router.post('/:id/duplicate', [auth, editPage('blogs')], blogsController.duplicateBlog);

module.exports = router;
