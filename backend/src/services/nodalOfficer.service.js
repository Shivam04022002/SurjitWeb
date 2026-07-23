const NodalOfficer = require('../models/NodalOfficer');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
            { companyName: rx }, { officerName: rx }, { designation: rx },
            { address: rx }, { email: rx }, { phone: rx }
        ];
    }

    return query;
};

// Display order first, then oldest — so officers left at the default order keep
// the sequence they were added in rather than reshuffling.
const SORT = { displayOrder: 1, createdAt: 1 };

const listPublicOfficers = async () => NodalOfficer.find({ status: 'Published' }).sort(SORT);

const listOfficers = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        NodalOfficer.find(query).sort(SORT).skip(skip).limit(limit),
        NodalOfficer.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getOfficerById = async (id) => {
    const officer = await NodalOfficer.findById(id);
    if (!officer) throw new AppError('Nodal officer not found', HTTP_STATUS.NOT_FOUND);
    return officer;
};

const createOfficer = async (data) => {
    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await NodalOfficer.countDocuments()) + 1;
    }
    return NodalOfficer.create(data);
};

const updateOfficer = async (id, data) => {
    const officer = await NodalOfficer.findById(id);
    if (!officer) throw new AppError('Nodal officer not found', HTTP_STATUS.NOT_FOUND);

    Object.assign(officer, data);
    await officer.save();
    return officer;
};

const deleteOfficer = async (id) => {
    const officer = await NodalOfficer.findById(id);
    if (!officer) throw new AppError('Nodal officer not found', HTTP_STATUS.NOT_FOUND);

    await NodalOfficer.findByIdAndDelete(id);
    return { deleted: true };
};

const setOfficerStatus = async (id, status) => {
    const officer = await NodalOfficer.findById(id);
    if (!officer) throw new AppError('Nodal officer not found', HTTP_STATUS.NOT_FOUND);
    officer.status = status;
    await officer.save();
    return officer;
};

const reorderOfficers = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await NodalOfficer.bulkWrite(bulkOps);
    return NodalOfficer.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicOfficers,
    listOfficers,
    getOfficerById,
    createOfficer,
    updateOfficer,
    deleteOfficer,
    setOfficerStatus,
    reorderOfficers
};
