const productService = require('../../services/products/product.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllProducts = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const products = await productService.getAllProducts({ category });
    return sendSuccess(res, 'Products fetched successfully', { products });
});

const getProductById = asyncHandler(async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    return sendSuccess(res, 'Product fetched successfully', { product });
});

const createProduct = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.files) {
        if (req.files.heroImage && req.files.heroImage[0]) {
            data.heroImage = buildFileResult(req.files.heroImage[0]);
        }
        if (req.files.bannerImage && req.files.bannerImage[0]) {
            data.bannerImage = buildFileResult(req.files.bannerImage[0]);
        }
        if (req.files.thumbnailImage && req.files.thumbnailImage[0]) {
            data.thumbnailImage = buildFileResult(req.files.thumbnailImage[0]);
        }
    }

    const product = await productService.createProduct(data);
    return sendSuccess(res, 'Product created successfully', { product }, HTTP_STATUS.CREATED);
});

const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };

    if (req.files) {
        const imageFields = ['heroImage', 'bannerImage', 'thumbnailImage'];
        for (const field of imageFields) {
            if (req.files[field] && req.files[field][0]) {
                const existing = await productService.getProductById(id);
                if (existing[field] && existing[field].fileName) {
                    await deleteUploadedFile(existing[field].fileName);
                }
                data[field] = buildFileResult(req.files[field][0]);
            }
        }
    }

    const product = await productService.updateProduct(id, data);
    return sendSuccess(res, 'Product updated successfully', { product });
});

const deleteProduct = asyncHandler(async (req, res) => {
    const product = await productService.deleteProduct(req.params.id);

    const imageFields = ['heroImage', 'bannerImage', 'thumbnailImage'];
    for (const field of imageFields) {
        if (product[field] && product[field].fileName) {
            await deleteUploadedFile(product[field].fileName);
        }
    }

    return sendSuccess(res, 'Product deleted successfully', {});
});

const toggleStatus = asyncHandler(async (req, res) => {
    const product = await productService.toggleProductStatus(req.params.id);
    return sendSuccess(res, `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`, { product });
});

const reorderProducts = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const products = await productService.reorderProducts(ids);
    return sendSuccess(res, 'Products reordered successfully', { products });
});

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleStatus,
    reorderProducts
};
