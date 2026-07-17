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
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    reorderProducts
};
