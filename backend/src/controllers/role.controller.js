const roleService = require('../services/role.service');
const { invalidatePermissionCache, permissionsForUser } = require('../middleware/permission');
const { levelsFromPermissions } = require('../constants/permissions');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// Roles and page permissions. Reading needs roles.view; every change needs
// roles.edit, which is the permission that governs this page itself.

const listRoles = asyncHandler(async (req, res) => {
    const result = await roleService.listRoles(req.query);
    return sendSuccess(res, 'Roles fetched successfully', result);
});

// The page catalogue the CMS builds its permission matrix from.
const getPermissionCatalogue = asyncHandler(async (req, res) => {
    return sendSuccess(res, 'Permission catalogue fetched successfully', roleService.permissionCatalogue());
});

// What the signed-in admin may reach. Every CMS session asks for this, so the
// menu and the routes are drawn from the same answer the API enforces.
const getMyPermissions = asyncHandler(async (req, res) => {
    const permissions = await permissionsForUser(req.user);
    return sendSuccess(res, 'Permissions fetched successfully', {
        role: req.user.role,
        permissions,
        levels: levelsFromPermissions(permissions)
    });
});

const getRoleById = asyncHandler(async (req, res) => {
    const role = await roleService.getRoleById(req.params.id);
    return sendSuccess(res, 'Role fetched successfully', { role });
});

const createRole = asyncHandler(async (req, res) => {
    // The acting admin decides what they are allowed to hand out.
    const role = await roleService.createRole(req.body, req.user);
    return sendSuccess(res, 'Role created successfully', { role }, HTTP_STATUS.CREATED);
});

const updateRole = asyncHandler(async (req, res) => {
    const role = await roleService.updateRole(req.params.id, req.body, req.user);
    // The holders of this role see the change on their next request rather
    // than when the cache would have expired.
    invalidatePermissionCache(role.key);
    return sendSuccess(res, 'Role updated successfully', { role });
});

module.exports = {
    listRoles,
    getPermissionCatalogue,
    getMyPermissions,
    getRoleById,
    createRole,
    updateRole
};
