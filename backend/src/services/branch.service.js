const Branch = require('../models/Branch');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.city) query.city = filters.city;
    if (filters.state) query.state = filters.state;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
            { branchName: rx }, { address: rx }, { city: rx },
            { state: rx }, { pincode: rx }, { phone: rx }, { email: rx }
        ];
    }

    return query;
};

// Display order first, then oldest — so branches left at the default order keep
// the sequence they were added in rather than reshuffling.
const SORT = { displayOrder: 1, createdAt: 1 };

const listPublicBranches = async () => Branch.find({ status: 'Published' }).sort(SORT);

const listBranches = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        Branch.find(query).sort(SORT).skip(skip).limit(limit),
        Branch.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getBranchById = async (id) => {
    const branch = await Branch.findById(id);
    if (!branch) throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
    return branch;
};

const createBranch = async (data) => {
    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await Branch.countDocuments()) + 1;
    }
    return Branch.create(data);
};

const updateBranch = async (id, data) => {
    const branch = await Branch.findById(id);
    if (!branch) throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);

    Object.assign(branch, data);
    await branch.save();
    return branch;
};

const deleteBranch = async (id) => {
    const branch = await Branch.findById(id);
    if (!branch) throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);

    await Branch.findByIdAndDelete(id);
    return { deleted: true };
};

const setBranchStatus = async (id, status) => {
    const branch = await Branch.findById(id);
    if (!branch) throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
    branch.status = status;
    await branch.save();
    return branch;
};

const reorderBranches = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await Branch.bulkWrite(bulkOps);
    return Branch.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicBranches,
    listBranches,
    getBranchById,
    createBranch,
    updateBranch,
    deleteBranch,
    setBranchStatus,
    reorderBranches
};
