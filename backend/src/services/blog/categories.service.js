const BlogCategory = require('../../models/BlogCategory');
const Blog = require('../../models/Blog');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllCategories = async (filters = {}) => {
    const query = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.search) query.name = new RegExp(filters.search, 'i');

    return BlogCategory.find(query)
        .populate('blogsCount')
        .sort({ displayOrder: 1, name: 1 });
};

const getCategoryById = async (id) => {
    const category = await BlogCategory.findById(id).populate('blogsCount');
    if (!category) throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND);
    return category;
};

const getActiveCategoryBySlug = async (slug) => {
    const category = await BlogCategory.findOne({ slug, isActive: true });
    if (!category) throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND);
    return category;
};

const slugExists = async (slug, excludeId = null) => {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    return !!(await BlogCategory.findOne(query));
};

const createCategory = async (data) => {
    if (await slugExists(data.slug)) {
        throw new AppError('A blog category with this slug already exists', HTTP_STATUS.CONFLICT);
    }
    if (data.displayOrder === undefined || data.displayOrder === null) {
        data.displayOrder = (await BlogCategory.countDocuments()) + 1;
    }
    return BlogCategory.create(data);
};

const updateCategory = async (id, data) => {
    const category = await BlogCategory.findById(id);
    if (!category) throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND);

    if (data.slug && data.slug !== category.slug && await slugExists(data.slug, id)) {
        throw new AppError('A blog category with this slug already exists', HTTP_STATUS.CONFLICT);
    }

    Object.assign(category, data);
    await category.save();
    return BlogCategory.findById(id).populate('blogsCount');
};

// Blogs outlive their category: the reference is cleared rather than cascading
// a delete, so posts stay published and simply become uncategorised.
const deleteCategory = async (id) => {
    const category = await BlogCategory.findById(id);
    if (!category) throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND);

    await Blog.updateMany({ category: id }, { $set: { category: null } });
    await BlogCategory.findByIdAndDelete(id);
    return { deleted: true };
};

const toggleCategoryStatus = async (id) => {
    const category = await BlogCategory.findById(id);
    if (!category) throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND);
    category.isActive = !category.isActive;
    await category.save();
    return category;
};

module.exports = {
    getAllCategories,
    getCategoryById,
    getActiveCategoryBySlug,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
};
