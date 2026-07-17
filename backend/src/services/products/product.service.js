const Product = require('../../models/Product');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllProducts = async (filters = {}) => {
    const query = {};
    if (filters.category) query.category = filters.category;
    return Product.find(query)
        .populate('category', 'name slug')
        .sort({ displayOrder: 1, createdAt: 1 })
        .select('-features -eligibility -documents -interestRates -faqs -emiConfig -seo');
};

// Public-facing list for a category's product slider. Only the card fields are
// selected; the heavy section arrays are fetched per-product on the detail page.
const getActiveProductsByCategory = async (categoryId) => {
    return Product.find({ category: categoryId, isActive: true })
        .sort({ displayOrder: 1, createdAt: 1 })
        .select('name slug shortDescription heroDescription thumbnailImage heroImage bannerImage displayOrder')
        .lean();
};

// The landing product for each of the given categories: the first active one by
// displayOrder. Backs the header dropdown, where a category links straight to a
// product page. One aggregation rather than a query per category.
// Returns a Map keyed by category id string; a category with no active products
// is absent from the Map.
const getFirstActiveProductPerCategory = async (categoryIds) => {
    if (!categoryIds || categoryIds.length === 0) return new Map();

    const rows = await Product.aggregate([
        { $match: { category: { $in: categoryIds }, isActive: true } },
        { $sort: { displayOrder: 1, createdAt: 1 } },
        { $group: { _id: '$category', slug: { $first: '$slug' }, name: { $first: '$name' } } }
    ]);

    return new Map(rows.map(r => [String(r._id), { slug: r.slug, name: r.name }]));
};

const getProductById = async (id) => {
    const product = await Product.findById(id).populate('category', 'name slug');
    if (!product) {
        throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
    }
    return product;
};

const createProduct = async (data) => {
    const existing = await Product.findOne({ slug: data.slug });
    if (existing) {
        throw new AppError('A product with this slug already exists', HTTP_STATUS.CONFLICT);
    }
    return Product.create(data);
};

const updateProduct = async (id, data) => {
    if (data.slug) {
        const existing = await Product.findOne({ slug: data.slug, _id: { $ne: id } });
        if (existing) {
            throw new AppError('A product with this slug already exists', HTTP_STATUS.CONFLICT);
        }
    }

    const product = await Product.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    }).populate('category', 'name slug');

    if (!product) {
        throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
    }
    return product;
};

const deleteProduct = async (id) => {
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
        throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
    }
    return product;
};

const toggleProductStatus = async (id) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
    }
    product.isActive = !product.isActive;
    await product.save();
    return product;
};

const reorderProducts = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await Product.bulkWrite(bulkOps);
    return Product.find()
        .populate('category', 'name slug')
        .sort({ displayOrder: 1 })
        .select('-features -eligibility -documents -interestRates -faqs -emiConfig -seo');
};

module.exports = {
    getAllProducts,
    getActiveProductsByCategory,
    getFirstActiveProductPerCategory,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    reorderProducts
};
