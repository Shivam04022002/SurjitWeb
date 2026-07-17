const categoryService = require('../../services/products/category.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories();
    return sendSuccess(res, 'Categories fetched successfully', { categories });
});

const getCategoryById = asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.id);
    return sendSuccess(res, 'Category fetched successfully', { category });
});

const createCategory = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
        data.bannerImage = buildFileResult(req.files.bannerImage[0]);
    }
    if (req.files && req.files.icon && req.files.icon[0]) {
        data.icon = buildFileResult(req.files.icon[0]);
    }

    const category = await categoryService.createCategory(data);
    return sendSuccess(res, 'Category created successfully', { category }, HTTP_STATUS.CREATED);
});

const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };

    if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
        const existing = await categoryService.getCategoryById(id);
        if (existing.bannerImage && existing.bannerImage.fileName) {
            await deleteUploadedFile(existing.bannerImage.fileName);
        }
        data.bannerImage = buildFileResult(req.files.bannerImage[0]);
    }
    if (req.files && req.files.icon && req.files.icon[0]) {
        const existing = await categoryService.getCategoryById(id);
        if (existing.icon && existing.icon.fileName) {
            await deleteUploadedFile(existing.icon.fileName);
        }
        data.icon = buildFileResult(req.files.icon[0]);
    }

    const category = await categoryService.updateCategory(id, data);
    return sendSuccess(res, 'Category updated successfully', { category });
});

const deleteCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.deleteCategory(req.params.id);

    if (category.bannerImage && category.bannerImage.fileName) {
        await deleteUploadedFile(category.bannerImage.fileName);
    }
    if (category.icon && category.icon.fileName) {
        await deleteUploadedFile(category.icon.fileName);
    }

    return sendSuccess(res, 'Category deleted successfully', {});
});

const toggleStatus = asyncHandler(async (req, res) => {
    const category = await categoryService.toggleCategoryStatus(req.params.id);
    return sendSuccess(res, `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`, { category });
});

const reorderCategories = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const categories = await categoryService.reorderCategories(ids);
    return sendSuccess(res, 'Categories reordered successfully', { categories });
});

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleStatus,
    reorderCategories
};
