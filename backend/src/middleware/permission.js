const roleService = require('../services/role.service');
const { ROLES } = require('../constants/roles');
const { isPermission, viewPermission, editPermission } = require('../constants/permissions');
const { sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// Permission enforcement. This is where access is decided — hiding a button in
// the CMS is a courtesy to the administrator, never a control.
//
// `auth` has already loaded the admin from the database, so the role on the
// request is the role the admin holds right now: a permission taken away is
// gone on the next request, with nothing to invalidate and no one to log out.

// Role permissions change rarely and are read on every request, so they are
// held briefly rather than fetched each time. The window is short enough that
// a change an administrator makes is live before they can navigate to check.
const CACHE_MS = 5000;
const cache = new Map();

const permissionsOf = async (roleKey) => {
    const now = Date.now();
    const hit = cache.get(roleKey);
    if (hit && hit.expires > now) return hit.value;

    const role = await roleService.permissionsForRoleKey(roleKey);
    // A role that no longer exists, or one that has been deactivated, carries
    // nothing: its holders keep their session and lose their access.
    const value = role && role.status === 'Active' ? new Set(role.permissions) : new Set();

    cache.set(roleKey, { value, expires: now + CACHE_MS });
    return value;
};

// Called whenever a role's permissions change, so the next request sees them
// rather than waiting out the window.
const invalidatePermissionCache = (roleKey) => {
    if (roleKey) cache.delete(roleKey);
    else cache.clear();
};

// Whether an admin holds a permission. Super Admin always does — the role that
// repairs a mistake on the roles page cannot be locked out by one.
const holds = async (user, permission) => {
    if (!user || !user.role) return false;
    if (user.role === ROLES.SUPER_ADMIN) return true;
    return (await permissionsOf(user.role)).has(permission);
};

// Guards a route with one permission. `auth` must run first; without it there
// is no admin to check and the request is unauthorised, not forbidden.
const requirePermission = (permission) => {
    if (!isPermission(permission)) {
        // A typo here would silently protect nothing, so it stops the process
        // at startup rather than at the first request.
        throw new Error(`Unknown permission: ${permission}`);
    }

    return asyncHandler(async (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'Unauthorized', [], HTTP_STATUS.UNAUTHORIZED);
        }
        if (await holds(req.user, permission)) return next();

        return sendError(
            res,
            'You do not have permission to access this resource',
            [],
            HTTP_STATUS.FORBIDDEN
        );
    });
};

// The two a route usually wants, named after what they mean rather than after
// the string they check.
const canView = (pageKey) => requirePermission(viewPermission(pageKey));
const canEdit = (pageKey) => requirePermission(editPermission(pageKey));

// Everything the signed-in admin may reach, for the CMS to build its menu and
// guard its routes from. The same source the API enforces, so the two cannot
// drift apart.
const permissionsForUser = async (user) => {
    if (!user || !user.role) return [];
    const role = await roleService.permissionsForRoleKey(user.role);
    if (!role || role.status !== 'Active') return [];
    return role.permissions;
};

module.exports = {
    requirePermission,
    canView,
    canEdit,
    holds,
    permissionsForUser,
    invalidatePermissionCache,
    _cache: cache
};
