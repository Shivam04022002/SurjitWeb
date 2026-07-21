const adminService = require('../services/admin.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// CMS users are Admin documents. The module is exposed as "users" because that
// is what it is called in the panel, but it operates on the same accounts that
// authenticate against /v1/auth.
//
// The model's toJSON strips the password hash, so nothing here has to.

const listUsers = asyncHandler(async (req, res) => {
    const result = await adminService.listAdmins(req.query);
    return sendSuccess(res, 'Users fetched successfully', result);
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await adminService.getAdminById(req.params.id);
    return sendSuccess(res, 'User fetched successfully', { user });
});

const createUser = asyncHandler(async (req, res) => {
    const user = await adminService.createAdmin(req.body);
    return sendSuccess(res, 'User created successfully', { user }, HTTP_STATUS.CREATED);
});

// req.user is set by the auth middleware; passing the acting id lets the
// service refuse changes that would lock the current admin out.
const updateUser = asyncHandler(async (req, res) => {
    const user = await adminService.updateAdmin(req.params.id, req.body, req.user?._id);
    return sendSuccess(res, 'User updated successfully', { user });
});

const deleteUser = asyncHandler(async (req, res) => {
    await adminService.deleteAdmin(req.params.id, req.user?._id);
    return sendSuccess(res, 'User deleted successfully', {});
});

module.exports = {
    listUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};
