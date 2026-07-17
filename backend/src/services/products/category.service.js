const ProductCategory = require('../../models/ProductCategory');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllCategories = async () => {
    return ProductCategory.find().sort({ displayOrder: 1, createdAt: 1 });
};

const getCategoryById = async (id) => {
    const category = await ProductCategory.findById(id);
    if (!category) {
        throw new AppError('Product category not found', HTTP_STATUS.NOT_FOUND);
    }
    return category;
};

const createCategory = async (data) => {
    const existing = await ProductCategory.findOne({ slug: data.slug });
    if (existing) {
        throw new AppError('A category with this slug already exists', HTTP_STATUS.CONFLICT);
    }
    return ProductCategory.create(data);
};

const updateCategory = async (id, data) => {
    if (data.slug) {
        const existing = await ProductCategory.findOne({ slug: data.slug, _id: { $ne: id } });
        if (existing) {
            throw new AppError('A category with this slug already exists', HTTP_STATUS.CONFLICT);
        }
    }

    const category = await ProductCategory.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });
    if (!category) {
        throw new AppError('Product category not found', HTTP_STATUS.NOT_FOUND);
    }
    return category;
};

const deleteCategory = async (id) => {
    const category = await ProductCategory.findByIdAndDelete(id);
    if (!category) {
        throw new AppError('Product category not found', HTTP_STATUS.NOT_FOUND);
    }
    return category;
};

const toggleCategoryStatus = async (id) => {
    const category = await ProductCategory.findById(id);
    if (!category) {
        throw new AppError('Product category not found', HTTP_STATUS.NOT_FOUND);
    }
    category.isActive = !category.isActive;
    await category.save();
    return category;
};

const reorderCategories = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await ProductCategory.bulkWrite(bulkOps);
    return ProductCategory.find().sort({ displayOrder: 1 });
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    reorderCategories
};
