const categoriesService = require('../../services/blog/categories.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllCategories = asyncHandler(async (req, res) => {
    const { isActive, search } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    const categories = await categoriesService.getAllCategories(filters);
    return sendSuccess(res, 'Blog categories fetched successfully', { categories });
});

const getCategoryById = asyncHandler(async (req, res) => {
    const category = await categoriesService.getCategoryById(req.params.id);
    return sendSuccess(res, 'Blog category fetched successfully', { category });
});

const createCategory = asyncHandler(async (req, res) => {
    const category = await categoriesService.createCategory(req.body);
    return sendSuccess(res, 'Blog category created successfully', { category }, HTTP_STATUS.CREATED);
});

const updateCategory = asyncHandler(async (req, res) => {
    const category = await categoriesService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, 'Blog category updated successfully', { category });
});

const deleteCategory = asyncHandler(async (req, res) => {
    await categoriesService.deleteCategory(req.params.id);
    return sendSuccess(res, 'Blog category deleted successfully', {});
});

const toggleCategoryStatus = asyncHandler(async (req, res) => {
    const category = await categoriesService.toggleCategoryStatus(req.params.id);
    return sendSuccess(res, `Blog category ${category.isActive ? 'enabled' : 'disabled'} successfully`, { category });
});

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
};
