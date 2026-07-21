const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const env = require('../config/env');
const { ROLES } = require('../constants/roles');

const listAdmins = async (query = {}) => {
    const { page = 1, limit = 10, search = '', role } = query;

    // The model's pre(/^find/) hook hides soft-deleted admins, but it never runs
    // for countDocuments — so the count has to exclude them explicitly or the
    // total outruns the rows and the last page comes back short.
    const filter = { deletedAt: null };

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

const getAdminById = async (id) => {
    const admin = await Admin.findById(id);
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }
    return admin;
};

// Losing the last active super admin would leave nobody able to manage users,
// roles or deletions — an unrecoverable state from inside the CMS. Counting
// excludes the account being changed, so demoting or deactivating the only
// one is refused rather than silently locking everyone out.
const assertNotLastSuperAdmin = async (id) => {
    const others = await Admin.countDocuments({
        _id: { $ne: id },
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        deletedAt: null
    });
    if (others === 0) {
        throw new AppError(
            'This is the only active Super Admin. Promote another account first.',
            HTTP_STATUS.BAD_REQUEST
        );
    }
};

const updateAdmin = async (id, data, actingAdminId) => {
    const admin = await Admin.findById(id);
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }

    if (data.email && data.email !== admin.email) {
        const exists = await Admin.findOne({ email: data.email, _id: { $ne: id } });
        if (exists) {
            throw new AppError('Admin with this email already exists', HTTP_STATUS.CONFLICT);
        }
    }

    const losingSuperAdmin = admin.role === ROLES.SUPER_ADMIN
        && ((data.role && data.role !== ROLES.SUPER_ADMIN) || data.isActive === false);
    if (losingSuperAdmin) {
        await assertNotLastSuperAdmin(id);
    }

    // Changing your own role or deactivating yourself takes effect on the next
    // request and locks you out of the page you are standing on.
    if (actingAdminId && String(actingAdminId) === String(id)) {
        if (data.role && data.role !== admin.role) {
            throw new AppError('You cannot change your own role', HTTP_STATUS.BAD_REQUEST);
        }
        if (data.isActive === false) {
            throw new AppError('You cannot deactivate your own account', HTTP_STATUS.BAD_REQUEST);
        }
    }

    if (data.password) {
        const isAlreadyHashed = data.password.startsWith('$2a$') || data.password.startsWith('$2b$');
        if (!isAlreadyHashed) {
            data.password = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);
        }
    }

    const updated = await Admin.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return updated;
};

const deleteAdmin = async (id, actingAdminId) => {
    const admin = await Admin.findById(id);
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }

    if (actingAdminId && String(actingAdminId) === String(id)) {
        throw new AppError('You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
    }

    if (admin.role === ROLES.SUPER_ADMIN) {
        await assertNotLastSuperAdmin(id);
    }

    // Soft delete: the model's pre-find hook filters deletedAt, so the record
    // stays for audit while disappearing from every query.
    return Admin.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true });
};

module.exports = {
    listAdmins,
    getAdminById,
    createAdmin,
    updateAdmin,
    deleteAdmin
};
