const LegalPage = require('../models/LegalPage');
const { AppError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('./upload.service');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ title: rx }, { slug: rx }, { description: rx }, { type: rx }];
    }

    return query;
};

// Display order first, then oldest — so pages left at the default order keep the
// sequence they were added in rather than reshuffling.
const SORT = { displayOrder: 1, createdAt: 1 };

const listPublicPages = async () =>
    LegalPage.find({ status: 'Published' }).select('title slug type description displayOrder').sort(SORT);

const getPublishedPageBySlug = async (slug) => {
    const page = await LegalPage.findOne({ slug, status: 'Published' });
    if (!page) throw new AppError('Page not found', HTTP_STATUS.NOT_FOUND);
    return page;
};

const listPages = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        LegalPage.find(query).sort(SORT).skip(skip).limit(limit),
        LegalPage.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getPageById = async (id) => {
    const page = await LegalPage.findById(id);
    if (!page) throw new AppError('Page not found', HTTP_STATUS.NOT_FOUND);
    return page;
};

const ensureSlugFree = async (slug, exceptId = null) => {
    const clash = await LegalPage.findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
    if (clash) throw new AppError('A legal page with this slug already exists', HTTP_STATUS.CONFLICT);
};

const createPage = async (data, files = {}) => {
    await ensureSlugFree(data.slug);

    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await LegalPage.countDocuments()) + 1;
    }
    if (files.pdf) data.pdf = files.pdf;

    return LegalPage.create(data);
};

const updatePage = async (id, data, files = {}) => {
    const page = await LegalPage.findById(id);
    if (!page) throw new AppError('Page not found', HTTP_STATUS.NOT_FOUND);

    if (data.slug && data.slug !== page.slug) {
        await ensureSlugFree(data.slug, id);
    }

    if (files.pdf) {
        // Only an uploaded file (fileName set) is ours to remove; an external
        // link carries no stored object.
        if (page.pdf && page.pdf.fileName) {
            await deleteUploadedFile(page.pdf.fileName);
        }
        data.pdf = files.pdf;
    }

    Object.assign(page, data);
    await page.save();
    return page;
};

const deletePage = async (id) => {
    const page = await LegalPage.findById(id);
    if (!page) throw new AppError('Page not found', HTTP_STATUS.NOT_FOUND);

    if (page.pdf && page.pdf.fileName) {
        await deleteUploadedFile(page.pdf.fileName);
    }

    await LegalPage.findByIdAndDelete(id);
    return { deleted: true };
};

const setPageStatus = async (id, status) => {
    const page = await LegalPage.findById(id);
    if (!page) throw new AppError('Page not found', HTTP_STATUS.NOT_FOUND);
    page.status = status;
    await page.save();
    return page;
};

const reorderPages = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await LegalPage.bulkWrite(bulkOps);
    return LegalPage.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicPages,
    getPublishedPageBySlug,
    listPages,
    getPageById,
    createPage,
    updatePage,
    deletePage,
    setPageStatus,
    reorderPages
};
