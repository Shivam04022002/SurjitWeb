const HomepageStat = require('../models/HomepageStat');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ title: rx }, { value: rx }];
    }

    return query;
};

// Display order first, then oldest — so stats left at the default order keep the
// sequence they were added in rather than reshuffling.
const SORT = { displayOrder: 1, createdAt: 1 };

const listPublicStats = async () => HomepageStat.find({ status: 'Published' }).sort(SORT);

const listStats = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        HomepageStat.find(query).sort(SORT).skip(skip).limit(limit),
        HomepageStat.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getStatById = async (id) => {
    const stat = await HomepageStat.findById(id);
    if (!stat) throw new AppError('Statistic not found', HTTP_STATUS.NOT_FOUND);
    return stat;
};

const createStat = async (data) => {
    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await HomepageStat.countDocuments()) + 1;
    }
    return HomepageStat.create(data);
};

const updateStat = async (id, data) => {
    const stat = await HomepageStat.findById(id);
    if (!stat) throw new AppError('Statistic not found', HTTP_STATUS.NOT_FOUND);

    Object.assign(stat, data);
    await stat.save();
    return stat;
};

const deleteStat = async (id) => {
    const stat = await HomepageStat.findById(id);
    if (!stat) throw new AppError('Statistic not found', HTTP_STATUS.NOT_FOUND);

    await HomepageStat.findByIdAndDelete(id);
    return { deleted: true };
};

const setStatStatus = async (id, status) => {
    const stat = await HomepageStat.findById(id);
    if (!stat) throw new AppError('Statistic not found', HTTP_STATUS.NOT_FOUND);
    stat.status = status;
    await stat.save();
    return stat;
};

const reorderStats = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await HomepageStat.bulkWrite(bulkOps);
    return HomepageStat.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicStats,
    listStats,
    getStatById,
    createStat,
    updateStat,
    deleteStat,
    setStatStatus,
    reorderStats
};
