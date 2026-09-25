const Role = require('../models/Role');
const Admin = require('../models/Admin');
const { ROLES, ROLE_LABELS } = require('../constants/roles');
const {
    LEVELS, PAGE_KEYS, everyPageAt,
    levelsFromPermissions, permissionsFromLevels, normalisePermissions
} = require('../constants/permissions');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const logger = require('../utils/logger');

const { keyFromName, comparableName } = Role;

// Roles and what each may reach.
//
// Every admin already carries a role key, so roles move into the database
// under the keys that are already in use: nothing is renamed, re-pointed or
// deleted, and an admin record is never touched by anything here.

// ── The roles the CMS ships with ─────────────────────────────────────────────
//
// These reproduce the access each role had when authorisation was written into
// the routes, so bringing roles into the database changes nobody's reach.
//
// Content Manager is the one judgement call: it could previously read every
// page and edit existing records, but not create or delete. Two levels cannot
// express that, so it is defined as view — the conservative direction, since
// the alternative would hand it creation and deletion it never had.
const SYSTEM_ROLES = [
    {
        key: ROLES.SUPER_ADMIN,
        name: ROLE_LABELS[ROLES.SUPER_ADMIN],
        description: 'Full access to every page and every action, including roles.',
        levels: everyPageAt(LEVELS.EDIT)
    },
    {
        key: ROLES.EDITOR,
        name: ROLE_LABELS[ROLES.EDITOR],
        description: 'Manages website content. Cannot manage CMS users, roles or API settings.',
        levels: {
            ...everyPageAt(LEVELS.EDIT),
            users: LEVELS.NONE,
            roles: LEVELS.NONE,
            integrations: LEVELS.NONE
        }
    },
    {
        key: ROLES.CONTENT_MANAGER,
        name: ROLE_LABELS[ROLES.CONTENT_MANAGER],
        description: 'Reads website content. Cannot manage CMS users, roles, API settings or AI blogs.',
        levels: {
            ...everyPageAt(LEVELS.VIEW),
            users: LEVELS.NONE,
            roles: LEVELS.NONE,
            integrations: LEVELS.NONE,
            geminiBlogs: LEVELS.NONE
        }
    }
];

// Creates any system role that is missing and leaves every existing one alone,
// except Super Admin, whose permissions are restored to everything — that is
// the one role the application cannot function without.
//
// Safe to run on every boot: it never deletes, never renames, and never
// rewrites a role an administrator has adjusted.
const ensureSystemRoles = async () => {
    for (const definition of SYSTEM_ROLES) {
        const permissions = permissionsFromLevels(definition.levels).permissions;
        const existing = await Role.findOne({ key: definition.key });

        if (!existing) {
            await Role.create({
                key: definition.key,
                name: definition.name,
                description: definition.description,
                permissions,
                isSystem: true,
                status: 'Active'
            });
            logger.info('System role created', { role: definition.key });
            continue;
        }

        // Super Admin is repaired rather than trusted: whatever it holds, it
        // ends up holding everything.
        if (definition.key === ROLES.SUPER_ADMIN) {
            const missing = permissions.filter((p) => !existing.permissions.includes(p));
            if (missing.length || !existing.isSystem || existing.status !== 'Active') {
                existing.permissions = permissions;
                existing.isSystem = true;
                existing.status = 'Active';
                await existing.save();
                logger.info('Super Admin permissions restored', { restored: missing.length });
            }
            continue;
        }

        if (!existing.isSystem) {
            existing.isSystem = true;
            await existing.save();
        }
    }
};

// The permissions a role key carries, or null when the key is unknown.
//
// Super Admin is answered from the definition rather than from storage, so a
// damaged or missing record can never lock everyone out of the CMS. The other
// roles the application ships with fall back to their definition too, and only
// when no record exists — a database that has not been through a boot yet, or
// a fresh one, still behaves as the application expects. Once a record exists
// it wins, including when an administrator has deliberately reduced it.
const systemDefinition = (key) => SYSTEM_ROLES.find((r) => r.key === key);

const permissionsForRoleKey = async (key) => {
    if (key === ROLES.SUPER_ADMIN) {
        return { key, status: 'Active', permissions: permissionsFromLevels(everyPageAt(LEVELS.EDIT)).permissions };
    }

    const role = await Role.findOne({ key }).lean();
    if (role) {
        return { key: role.key, status: role.status, permissions: normalisePermissions(role.permissions) };
    }

    const definition = systemDefinition(key);
    if (definition) {
        return { key, status: 'Active', permissions: permissionsFromLevels(definition.levels).permissions };
    }
    return null;
};

// ── Reading ──────────────────────────────────────────────────────────────────

// How many admins hold each role, for the list. One grouped query rather than
// one per row.
const userCounts = async () => {
    const rows = await Admin.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

const shape = (role, counts = {}) => ({
    _id: role._id,
    key: role.key,
    name: role.name,
    description: role.description,
    status: role.status,
    isSystem: role.isSystem,
    userCount: counts[role.key] || 0,
    permissions: normalisePermissions(role.permissions),
    levels: levelsFromPermissions(role.permissions),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt
});

const listRoles = async (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.search) {
        const rx = new RegExp(String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ name: rx }, { description: rx }, { key: rx }];
    }

    const [roles, counts] = await Promise.all([
        Role.find(query).sort({ isSystem: -1, name: 1 }).lean(),
        userCounts()
    ]);

    return { data: roles.map((r) => shape(r, counts)), total: roles.length };
};

const getRoleById = async (id) => {
    const role = await Role.findById(id).lean();
    if (!role) throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    return shape(role, await userCounts());
};

// ── Writing ──────────────────────────────────────────────────────────────────

const assertNameFree = async (name, exceptId = null) => {
    const query = { nameKey: comparableName(name) };
    if (exceptId) query._id = { $ne: exceptId };
    if (await Role.exists(query)) {
        throw new AppError('A role with this name already exists', HTTP_STATUS.CONFLICT);
    }
};

// Turns the page map the CMS sends into stored permissions, refusing anything
// it does not recognise instead of silently granting less than was asked for.
const resolvePermissions = (levels) => {
    if (levels === undefined) return undefined;
    if (!levels || typeof levels !== 'object' || Array.isArray(levels)) {
        throw new AppError('Permissions must be a page-to-access map', HTTP_STATUS.BAD_REQUEST);
    }

    const { permissions, invalidPages, invalidLevels } = permissionsFromLevels(levels);
    if (invalidPages.length) {
        throw new AppError(`Unknown page: ${invalidPages.join(', ')}`, HTTP_STATUS.BAD_REQUEST);
    }
    if (invalidLevels.length) {
        throw new AppError(`Access must be none, view or edit — ${invalidLevels.join('; ')}`, HTTP_STATUS.BAD_REQUEST);
    }
    return permissions;
};

// ── What an administrator may hand out ───────────────────────────────────────
//
// Holding roles.edit is the power to define what other people may do. Without
// a limit it is also the power to define what *you* may do, which would make
// it equivalent to every other permission at once.
//
// Two limits, both enforced here rather than in the CMS:
//
//   1. You cannot edit the role you yourself hold. Otherwise the shortest path
//      to full access is to tick every box on your own role.
//   2. You cannot grant a permission you do not hold. Otherwise you can mint a
//      role with more reach than your own and — with users.edit — put someone
//      there, or be put there.
//
// Super Admin is exempt from both: it already holds everything, so neither
// limit can bite, and it is the role that repairs the others.
const assertMayGrant = async (actor, permissions) => {
    if (!actor || !actor.role) return;
    if (actor.role === ROLES.SUPER_ADMIN) return;
    if (permissions === undefined) return;

    const own = await permissionsForRoleKey(actor.role);
    const held = new Set(own && own.status === 'Active' ? own.permissions : []);
    const beyond = permissions.filter((permission) => !held.has(permission));

    if (beyond.length) {
        throw new AppError(
            'You cannot grant a permission your own role does not have',
            HTTP_STATUS.FORBIDDEN
        );
    }
};

const assertNotOwnRole = (actor, role) => {
    if (!actor || !actor.role) return;
    if (actor.role === ROLES.SUPER_ADMIN) return;
    if (actor.role === role.key) {
        throw new AppError(
            'You cannot change the role you are signed in with. Ask a Super Admin.',
            HTTP_STATUS.FORBIDDEN
        );
    }
};

// The same limit, applied when an account is given a role: an administrator
// cannot put someone into a role that reaches further than their own. Without
// this, roles.edit plus users.edit would still add up to full access — mint a
// role, then assign it.
const assertMayAssignRole = async (actor, roleKey) => {
    if (!roleKey) return;
    if (!actor || !actor.role) return;
    if (actor.role === ROLES.SUPER_ADMIN) return;

    const [target, own] = await Promise.all([
        permissionsForRoleKey(roleKey),
        permissionsForRoleKey(actor.role)
    ]);
    if (!target) throw new AppError('That role does not exist', HTTP_STATUS.BAD_REQUEST);

    const held = new Set(own && own.status === 'Active' ? own.permissions : []);
    const beyond = target.permissions.filter((permission) => !held.has(permission));

    if (beyond.length) {
        throw new AppError(
            'You cannot assign a role with more access than your own',
            HTTP_STATUS.FORBIDDEN
        );
    }
};

// A key that is free, derived from the name. A second "HR Admin" cannot reach
// here (the name is checked first), so the suffix only ever resolves a clash
// with a differently-named role that happens to reduce to the same key.
const freeKeyFor = async (name) => {
    const base = keyFromName(name) || 'role';
    if (!(await Role.exists({ key: base }))) return base;
    for (let n = 2; n < 100; n += 1) {
        const candidate = `${base}_${n}`.slice(0, 40);
        if (!(await Role.exists({ key: candidate }))) return candidate;
    }
    throw new AppError('Could not derive a unique key for this role name', HTTP_STATUS.CONFLICT);
};

const createRole = async (data, actor = null) => {
    await assertNameFree(data.name);

    const permissions = resolvePermissions(data.permissions) || [];
    await assertMayGrant(actor, permissions);

    const role = await Role.create({
        key: await freeKeyFor(data.name),
        name: data.name,
        description: data.description || '',
        permissions,
        status: data.status || 'Active',
        isSystem: false
    });

    logger.info('Role created', { role: role.key });
    return shape(role.toObject(), await userCounts());
};

const updateRole = async (id, data, actor = null) => {
    const role = await Role.findById(id);
    if (!role) throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);

    assertNotOwnRole(actor, role);

    // Super Admin is what an administrator repairs the others with. Renaming
    // or describing it is allowed; reducing it is not.
    const isSuperAdmin = role.key === ROLES.SUPER_ADMIN;

    if (data.name !== undefined) {
        await assertNameFree(data.name, role._id);
        role.name = data.name;
    }
    if (data.description !== undefined) role.description = data.description;

    if (data.status !== undefined) {
        if (isSuperAdmin && data.status !== 'Active') {
            throw new AppError('Super Admin cannot be deactivated', HTTP_STATUS.BAD_REQUEST);
        }
        if (role.isSystem && data.status !== 'Active' && !isSuperAdmin) {
            const holders = (await userCounts())[role.key] || 0;
            if (holders > 0) {
                throw new AppError(`This role is still assigned to ${holders} user(s)`, HTTP_STATUS.BAD_REQUEST);
            }
        }
        role.status = data.status;
    }

    const permissions = resolvePermissions(data.permissions);
    if (permissions !== undefined) {
        if (isSuperAdmin) {
            throw new AppError('Super Admin always has every permission and cannot be changed', HTTP_STATUS.BAD_REQUEST);
        }
        await assertMayGrant(actor, permissions);
        role.permissions = permissions;
    }

    await role.save();
    logger.info('Role updated', { role: role.key });
    return shape(role.toObject(), await userCounts());
};

// The catalogue the CMS draws its permission matrix from, so the page list an
// administrator sees is the same one the API enforces.
const permissionCatalogue = () => {
    const { PAGES } = require('../constants/permissions');
    const modules = [];
    for (const page of PAGES) {
        let group = modules.find((m) => m.module === page.module);
        if (!group) { group = { module: page.module, pages: [] }; modules.push(group); }
        group.pages.push({ key: page.key, label: page.label, path: page.path });
    }
    return { modules, levels: [LEVELS.NONE, LEVELS.VIEW, LEVELS.EDIT], pageKeys: PAGE_KEYS };
};

module.exports = {
    SYSTEM_ROLES,
    assertMayAssignRole,
    ensureSystemRoles,
    permissionsForRoleKey,
    listRoles,
    getRoleById,
    createRole,
    updateRole,
    permissionCatalogue
};
