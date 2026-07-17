const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const env = require('../config/env');

const listAdmins = async (query = {}) => {
    const { page = 1, limit = 10, search = '', role } = query;
    const filter = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    if (role) {
        filter.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
        Admin.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Admin.countDocuments(filter)
    ]);

    return { data, total, page: parseInt(page), limit: parseInt(limit) };
};

const createAdmin = async (data) => {
    const exists = await Admin.findOne({ email: data.email });
    if (exists) {
        throw new AppError('Admin with this email already exists', HTTP_STATUS.CONFLICT);
    }

    const admin = await Admin.create(data);
    return admin;
};

const updateAdmin = async (id, data) => {
    if (data.password) {
        const isAlreadyHashed = data.password.startsWith('$2a$') || data.password.startsWith('$2b$');
        if (!isAlreadyHashed) {
            data.password = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);
        }
    }

    const admin = await Admin.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }
    return admin;
};

const deleteAdmin = async (id) => {
    const admin = await Admin.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }
    return admin;
};

module.exports = {
    listAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin
};
