const Advertisement = require('../models/Advertisement');
const { deleteUploadedFile } = require('../services/upload.service');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const logger = require('../utils/logger');

// Advertisements for the website popup. Everything here but
// getPublicAdvertisement is reached only through the authenticated CMS routes.
//
// One rule runs through all of it: at most one advertisement is Published.
// The database enforces it with a partial unique index (see the model); the
// service keeps to an order that can only ever leave *fewer* published
// advertisements, never two.

const SORT = { createdAt: -1 };

const buildQuery = (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ name: rx }, { applyButtonText: rx }];
    }
    return query;
};

const listAdvertisements = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        Advertisement.find(query).sort(SORT).skip(skip).limit(limit),
        Advertisement.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getAdvertisementById = async (id) => {
    const advertisement = await Advertisement.findById(id);
    if (!advertisement) throw new AppError('Advertisement not found', HTTP_STATUS.NOT_FOUND);
    return advertisement;
};

// The uploaded artwork, as the record stores it. `image` is what the upload
// middleware produced ({ url, fileName, size }); it exists only once the file
// is safely in storage, so nothing here can write a URL for an upload that
// never happened.
const imageFields = (image) => (image
    ? { imageUrl: image.url, imageFileName: image.fileName }
    : {});

// A new advertisement is always a draft: publishing is its own action, so
// creating one can never take the live slot from another. An image may come
// with it, but uploading one never publishes anything.
const createAdvertisement = async (data, image = null) => Advertisement.create({
    ...data,
    ...imageFields(image),
    status: 'Draft',
    publishedAt: null
});

// Content, and optionally a new image. Status and publishedAt are not
// writable here — publish and unpublish own them, which is what keeps the
// one-published rule intact.
//
// Replacing an image: the record is saved first, and only then is the
// previous object removed. If the save fails, the old image is still the one
// on record and still in storage; the new object is left in place rather than
// risking the deletion of something a live advertisement still points at.
const updateAdvertisement = async (id, data, image = null) => {
    const advertisement = await getAdvertisementById(id);
    const { status, publishedAt, imageUrl, imageFileName, ...fields } = data;
    const previousFileName = advertisement.imageFileName;

    Object.assign(advertisement, fields, imageFields(image));
    await advertisement.save();

    if (image && previousFileName && previousFileName !== image.fileName) {
        // Best effort, and only after the record no longer refers to it.
        await deleteUploadedFile(previousFileName);
        logger.info('Advertisement image replaced', { advertisement: String(advertisement._id) });
    }
    return advertisement;
};

// Publishing B while A is live: A steps down first, then B goes live. If the
// second step fails, nothing is published — never two. The partial unique
// index is the backstop if two publishes race each other.
const publishAdvertisement = async (id) => {
    const advertisement = await getAdvertisementById(id);
    if (advertisement.status === 'Published') return advertisement;

    const unpublished = await Advertisement.updateMany(
        { status: 'Published', _id: { $ne: advertisement._id } },
        { $set: { status: 'Draft', publishedAt: null } }
    );

    advertisement.status = 'Published';
    advertisement.publishedAt = new Date();
    try {
        await advertisement.save();
    } catch (err) {
        // 11000: another advertisement is still published (a racing publish).
        if (err.code === 11000) {
            throw new AppError('Another advertisement is already published. Try again.', HTTP_STATUS.CONFLICT);
        }
        throw err;
    }

    if (unpublished.modifiedCount) {
        logger.info('Advertisement published; previous one unpublished', {
            published: String(advertisement._id), replaced: unpublished.modifiedCount
        });
    }
    return advertisement;
};

const unpublishAdvertisement = async (id) => {
    const advertisement = await getAdvertisementById(id);
    advertisement.status = 'Draft';
    advertisement.publishedAt = null;
    await advertisement.save();
    return advertisement;
};

// A published advertisement is live on the website, so it is unpublished
// deliberately before it can be removed — deleting it in one step would take
// it off the site as a side effect.
const deleteAdvertisement = async (id) => {
    const advertisement = await getAdvertisementById(id);
    if (advertisement.status === 'Published') {
        throw new AppError('Unpublish this advertisement before deleting it.', HTTP_STATUS.BAD_REQUEST);
    }

    await Advertisement.findByIdAndDelete(id);
    if (advertisement.imageFileName) await deleteUploadedFile(advertisement.imageFileName);
    return { deleted: true };
};

// ── Public ─────────────────────────────────────────────────────────────────────

// The one advertisement the website may show, or null.
//
// Published is the only condition: there is no "latest" or "first" fallback,
// so a draft can never reach a visitor. The query is served by the partial
// unique index on status, which contains exactly the published documents.
//
// An advertisement with no artwork is treated as nothing to show rather than
// sent out with a broken image. The record is left exactly as it is — this is
// a read.
const getPublicAdvertisement = async () => {
    const advertisement = await Advertisement
        .findOne({ status: 'Published' })
        .select('name imageUrl applyUrl applyButtonText')
        .lean();

    if (!advertisement || !advertisement.imageUrl || !advertisement.imageUrl.trim()) return null;

    // Built field by field, so nothing internal can reach the public response
    // by being added to the model later: the storage key, the timestamps and
    // the publishing state all stay inside the CMS.
    return {
        id: String(advertisement._id),
        name: advertisement.name,
        imageUrl: advertisement.imageUrl,
        applyUrl: advertisement.applyUrl || '',
        applyButtonText: advertisement.applyButtonText || 'Apply'
    };
};

module.exports = {
    getPublicAdvertisement,
    listAdvertisements,
    getAdvertisementById,
    createAdvertisement,
    updateAdvertisement,
    publishAdvertisement,
    unpublishAdvertisement,
    deleteAdvertisement
};
