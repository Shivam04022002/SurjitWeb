// Roles and page permissions: end-to-end over HTTP against an in-memory
// MongoDB, with real JWTs for each role.
//
// What these tests are really about: a role's page access decides what the API
// allows, not what the CMS chooses to draw. A role with view opens a page and
// is refused every change; a role with nothing is refused entirely.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-role-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-role-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const Branch = require('../src/models/Branch');
const roleService = require('../src/services/role.service');
const { invalidatePermissionCache } = require('../src/middleware/permission');
const { ROLES } = require('../src/constants/roles');
const { levelsFromPermissions, LEVELS } = require('../src/constants/permissions');
const { generateAccessToken } = require('../src/utils/token');

let mongo;
let server;
let baseUrl;
const tokens = {};

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: json, text };
};

const BASE = '/v1/roles';

// An admin holding a role built for the test, and its token.
const adminWith = async (label, levels, { status = 'Active' } = {}) => {
    const role = await roleService.createRole({
        name: `Test ${label}`,
        description: `${label} fixture`,
        permissions: levels,
        status
    });
    const admin = await Admin.create({
        name: `Admin ${label}`,
        email: `role-${label.toLowerCase().replace(/\s+/g, '-')}@test.local`,
        password: 'Password@123',
        role: role.key,
        isActive: true
    });
    invalidatePermissionCache();
    return { role, admin, token: generateAccessToken({ id: admin._id, role: role.key }) };
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Role.syncIndexes();

    // The roles the application ships with, created exactly as a boot would.
    await roleService.ensureSystemRoles();

    const seats = { super: ROLES.SUPER_ADMIN, editor: ROLES.EDITOR, content: ROLES.CONTENT_MANAGER };
    for (const [key, role] of Object.entries(seats)) {
        const admin = await Admin.create({
            name: `Role ${key}`, email: `role-${key}@test.local`, password: 'Password@123', role, isActive: true
        });
        tokens[key] = generateAccessToken({ id: admin._id, role });
    }

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
});

beforeEach(async () => {
    await Role.deleteMany({ isSystem: false });
    await Admin.deleteMany({ email: /^role-test-/ });
    await Branch.deleteMany({});
    invalidatePermissionCache();
});

// ── The roles the CMS ships with ──────────────────────────────────────────────
describe('System roles', () => {
    test('exist after boot, under the keys admins already hold', async () => {
        const keys = (await Role.find({ isSystem: true }).lean()).map((r) => r.key).sort();
        assert.deepEqual(keys, [ROLES.CONTENT_MANAGER, ROLES.EDITOR, ROLES.SUPER_ADMIN].sort());
    });

    test('creating them again changes nothing', async () => {
        const before = await Role.find({ isSystem: true }).lean();
        await roleService.ensureSystemRoles();
        const after = await Role.find({ isSystem: true }).lean();

        assert.equal(after.length, before.length);
        for (const role of before) {
            const now = after.find((r) => r.key === role.key);
            assert.deepEqual(now.permissions.sort(), role.permissions.sort(), role.key);
            assert.equal(String(now._id), String(role._id), 'the same record, not a replacement');
        }
    });

    test('Super Admin holds every page at edit', async () => {
        const levels = levelsFromPermissions((await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean()).permissions);
        assert.ok(Object.values(levels).every((l) => l === LEVELS.EDIT), JSON.stringify(levels));
    });

    test('Editor manages content but not users, roles or API settings', async () => {
        const levels = levelsFromPermissions((await Role.findOne({ key: ROLES.EDITOR }).lean()).permissions);
        assert.equal(levels.blogs, LEVELS.EDIT);
        assert.equal(levels.users, LEVELS.NONE);
        assert.equal(levels.roles, LEVELS.NONE);
        assert.equal(levels.integrations, LEVELS.NONE);
    });
});

// ── Creating ─────────────────────────────────────────────────────────────────
describe('Creating a role', () => {
    const NEW = {
        name: 'HR Reviewer',
        description: 'Can review employee records',
        permissions: { blogs: 'view', branches: 'view', reviews: 'edit', reports: 'view' }
    };

    test('a Super Admin can create one, with its pages at the levels asked for', async () => {
        const res = await call('POST', BASE, { token: tokens.super, body: NEW });
        assert.equal(res.status, 201, res.text);

        const role = res.body.data.role;
        assert.equal(role.name, 'HR Reviewer');
        assert.equal(role.isSystem, false);
        assert.equal(role.status, 'Active');
        assert.equal(role.levels.blogs, 'view');
        assert.equal(role.levels.reviews, 'edit');
        assert.equal(role.levels.users, 'none', 'a page not mentioned is not granted');
    });

    test('edit brings view with it, without being asked for', async () => {
        const res = await call('POST', BASE, { token: tokens.super, body: { name: 'Edit implies view', permissions: { reviews: 'edit' } } });
        assert.equal(res.status, 201, res.text);
        assert.ok(res.body.data.role.permissions.includes('reviews.view'));
        assert.ok(res.body.data.role.permissions.includes('reviews.edit'));
        assert.equal(res.body.data.role.levels.reviews, 'edit');
    });

    test('a duplicate name is refused, whatever its casing or spacing', async () => {
        assert.equal((await call('POST', BASE, { token: tokens.super, body: NEW })).status, 201);

        for (const name of ['HR Reviewer', 'hr reviewer', '  HR   REVIEWER  ']) {
            const res = await call('POST', BASE, { token: tokens.super, body: { ...NEW, name } });
            assert.equal(res.status, 409, `${name} -> ${res.text}`);
        }
        assert.equal(await Role.countDocuments({ isSystem: false }), 1);
    });

    test('a name is required and capped', async () => {
        for (const name of [undefined, '', '   ', 'x'.repeat(61)]) {
            const res = await call('POST', BASE, { token: tokens.super, body: { ...NEW, name } });
            assert.equal(res.status, 400, `${name} -> ${res.status}`);
        }
    });

    test('an unknown page or access level is refused, not quietly dropped', async () => {
        const page = await call('POST', BASE, { token: tokens.super, body: { name: 'Bad page', permissions: { payroll: 'view' } } });
        assert.equal(page.status, 400, page.text);
        assert.match(page.body.message, /payroll/);

        const level = await call('POST', BASE, { token: tokens.super, body: { name: 'Bad level', permissions: { blogs: 'admin' } } });
        assert.equal(level.status, 400, level.text);
        assert.match(level.body.message, /none, view or edit/);

        assert.equal(await Role.countDocuments({ isSystem: false }), 0);
    });

    test('the key and the system flag cannot be chosen by the request', async () => {
        for (const field of ['key', 'isSystem']) {
            const res = await call('POST', BASE, { token: tokens.super, body: { ...NEW, name: `Sneaky ${field}`, [field]: 'x' } });
            assert.equal(res.status, 400, field);
            assert.ok(res.body.errors.some((e) => e.field === field));
        }
    });

    test('the key is derived from the name', async () => {
        const res = await call('POST', BASE, { token: tokens.super, body: { name: 'Regional Content Lead' } });
        assert.equal(res.body.data.role.key, 'regional_content_lead');
    });
});

// ── Updating ─────────────────────────────────────────────────────────────────
describe('Updating a role', () => {
    const create = (body) => call('POST', BASE, { token: tokens.super, body });

    test('name, description and permissions can all be changed', async () => {
        const id = (await create({ name: 'Before', permissions: { blogs: 'view' } })).body.data.role._id;

        const res = await call('PUT', `${BASE}/${id}`, {
            token: tokens.super,
            body: { name: 'After', description: 'Updated', permissions: { blogs: 'edit', branches: 'view' } }
        });

        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.role.name, 'After');
        assert.equal(res.body.data.role.description, 'Updated');
        assert.equal(res.body.data.role.levels.blogs, 'edit');
        assert.equal(res.body.data.role.levels.branches, 'view');
    });

    test('permissions are replaced, not merged — removing a page removes it', async () => {
        const id = (await create({ name: 'Shrinking', permissions: { blogs: 'edit', branches: 'edit' } })).body.data.role._id;

        const res = await call('PUT', `${BASE}/${id}`, { token: tokens.super, body: { permissions: { blogs: 'view' } } });
        assert.equal(res.body.data.role.levels.blogs, 'view');
        assert.equal(res.body.data.role.levels.branches, 'none');
    });

    test('renaming onto another role is refused', async () => {
        await create({ name: 'Taken' });
        const id = (await create({ name: 'Free' })).body.data.role._id;

        const res = await call('PUT', `${BASE}/${id}`, { token: tokens.super, body: { name: 'taken' } });
        assert.equal(res.status, 409, res.text);
    });

    test('a role can be deactivated, and its holders then reach nothing', async () => {
        const { token, role } = await adminWith('Deactivated', { branches: 'edit' });
        assert.equal((await call('GET', '/v1/branches', { token })).status, 200);

        const off = await call('PUT', `${BASE}/${role._id}`, { token: tokens.super, body: { status: 'Inactive' } });
        assert.equal(off.status, 200, off.text);
        invalidatePermissionCache();

        assert.equal((await call('GET', '/v1/branches', { token })).status, 403, 'an inactive role carries nothing');
    });
});

// ── Super Admin is protected ─────────────────────────────────────────────────
describe('Super Admin cannot be reduced', () => {
    const superAdminId = async () => String((await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean())._id);

    test('its permissions cannot be changed through the API', async () => {
        const res = await call('PUT', `${BASE}/${await superAdminId()}`, {
            token: tokens.super,
            body: { permissions: { blogs: 'view' } }
        });
        assert.equal(res.status, 400, res.text);

        const levels = levelsFromPermissions((await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean()).permissions);
        assert.ok(Object.values(levels).every((l) => l === LEVELS.EDIT), 'still everything');
    });

    test('it cannot be deactivated', async () => {
        const res = await call('PUT', `${BASE}/${await superAdminId()}`, { token: tokens.super, body: { status: 'Inactive' } });
        assert.equal(res.status, 400, res.text);
        assert.equal((await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean()).status, 'Active');
    });

    test('even a record stripped in the database still grants everything', async () => {
        // The one role that repairs the others cannot be locked out by damage
        // to its own row.
        await Role.updateOne({ key: ROLES.SUPER_ADMIN }, { $set: { permissions: [] } });
        invalidatePermissionCache();

        assert.equal((await call('GET', BASE, { token: tokens.super })).status, 200);
        assert.equal((await call('GET', '/v1/branches', { token: tokens.super })).status, 200);

        await roleService.ensureSystemRoles();
        const restored = await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean();
        assert.ok(restored.permissions.length > 0, 'and boot repairs the record');
    });

    test('renaming it is allowed; it is a label, not the identity', async () => {
        const res = await call('PUT', `${BASE}/${await superAdminId()}`, { token: tokens.super, body: { description: 'The owner account' } });
        assert.equal(res.status, 200, res.text);
        assert.equal((await Role.findOne({ key: ROLES.SUPER_ADMIN }).lean()).key, ROLES.SUPER_ADMIN, 'the key never moves');
    });
});

// ── Who may manage roles ─────────────────────────────────────────────────────
describe('Access to the roles page itself', () => {
    test('an unauthenticated request is refused everywhere', async () => {
        assert.equal((await call('GET', BASE)).status, 401);
        assert.equal((await call('POST', BASE, { body: { name: 'Anon' } })).status, 401);
        assert.equal((await call('GET', `${BASE}/catalogue`)).status, 401);
    });

    test('a role without roles.view cannot read them', async () => {
        const { token } = await adminWith('No Roles Page', { blogs: 'view' });
        assert.equal((await call('GET', BASE, { token })).status, 403);

        // The page catalogue is not one of them: it is the list of pages this
        // application has, which every session needs to tell which page it is
        // on. It carries nothing about any role — asserted in its own suite.
        assert.equal((await call('GET', `${BASE}/catalogue`, { token })).status, 200);
    });

    test('roles.view reads but cannot create or change', async () => {
        const { token } = await adminWith('Roles Reader', { roles: 'view' });

        assert.equal((await call('GET', BASE, { token })).status, 200);
        assert.equal((await call('GET', `${BASE}/catalogue`, { token })).status, 200);

        const created = await call('POST', BASE, { token, body: { name: 'Should not exist' } });
        assert.equal(created.status, 403, created.text);
        assert.equal(await Role.countDocuments({ nameKey: 'should not exist' }), 0);

        const target = (await call('POST', BASE, { token: tokens.super, body: { name: 'Target' } })).body.data.role._id;
        assert.equal((await call('PUT', `${BASE}/${target}`, { token, body: { name: 'Renamed' } })).status, 403);
    });

    test('roles.edit may create and change, within its own reach', async () => {
        const { token } = await adminWith('Roles Manager', { roles: 'edit', blogs: 'view' });

        const created = await call('POST', BASE, { token, body: { name: 'Made by a manager', permissions: { blogs: 'view' } } });
        assert.equal(created.status, 201, created.text);
        assert.equal((await call('PUT', `${BASE}/${created.body.data.role._id}`, { token, body: { description: 'ok' } })).status, 200);
    });

    test('the roles the CMS shipped with keep their existing reach', async () => {
        // Editor and Content Manager never managed roles, and still do not.
        assert.equal((await call('GET', BASE, { token: tokens.editor })).status, 403);
        assert.equal((await call('GET', BASE, { token: tokens.content })).status, 403);
        assert.equal((await call('POST', BASE, { token: tokens.editor, body: { name: 'Editor role' } })).status, 403);
    });
});

// ── What a page permission actually does ─────────────────────────────────────
// Branches stands in for every content page: it has a read, a create, an
// update, a publish and a delete, which is the full shape.
describe('Page permissions on a real page', () => {
    const branch = { branchName: 'Test Branch', address: '1 Test Road', city: 'Ludhiana', state: 'Punjab', pincode: '141001' };
    const anExistingBranch = async () => Branch.create({ ...branch, branchName: `Existing ${Date.now()}` });

    test('no permission: the page is refused entirely', async () => {
        const { token } = await adminWith('Nothing', { blogs: 'view' });
        const existing = await anExistingBranch();

        assert.equal((await call('GET', '/v1/branches', { token })).status, 403);
        assert.equal((await call('GET', `/v1/branches/${existing._id}`, { token })).status, 403);
        assert.equal((await call('POST', '/v1/branches', { token, body: branch })).status, 403);
        assert.equal((await call('PUT', `/v1/branches/${existing._id}`, { token, body: { branchName: 'Changed' } })).status, 403);
        assert.equal((await call('DELETE', `/v1/branches/${existing._id}`, { token })).status, 403);
    });

    test('view: reads are allowed and every change is refused', async () => {
        const { token } = await adminWith('Viewer', { branches: 'view' });
        const existing = await anExistingBranch();

        assert.equal((await call('GET', '/v1/branches', { token })).status, 200);
        assert.equal((await call('GET', `/v1/branches/${existing._id}`, { token })).status, 200);

        assert.equal((await call('POST', '/v1/branches', { token, body: branch })).status, 403);
        assert.equal((await call('PUT', `/v1/branches/${existing._id}`, { token, body: { branchName: 'Changed' } })).status, 403);
        assert.equal((await call('PATCH', `/v1/branches/${existing._id}/publish`, { token })).status, 403);
        assert.equal((await call('DELETE', `/v1/branches/${existing._id}`, { token })).status, 403);

        const after = await Branch.findById(existing._id).lean();
        assert.equal(after.branchName, existing.branchName, 'nothing was changed by a refused request');
        assert.equal(await Branch.countDocuments(), 1, 'and nothing was created');
    });

    test('edit: reads and changes are both allowed', async () => {
        const { token } = await adminWith('Editor Of Branches', { branches: 'edit' });

        assert.equal((await call('GET', '/v1/branches', { token })).status, 200);

        const created = await call('POST', '/v1/branches', { token, body: branch });
        assert.equal(created.status, 201, created.text);
        const id = created.body.data.branch._id;

        assert.equal((await call('PUT', `/v1/branches/${id}`, { token, body: { branchName: 'Changed' } })).status, 200);
        assert.equal((await call('PATCH', `/v1/branches/${id}/publish`, { token })).status, 200);
        assert.equal((await call('DELETE', `/v1/branches/${id}`, { token })).status, 200);
    });

    test('a permission taken away applies to the very next request', async () => {
        const { token, role } = await adminWith('Demoted', { branches: 'edit' });
        assert.equal((await call('POST', '/v1/branches', { token, body: branch })).status, 201);

        await call('PUT', `${BASE}/${role._id}`, { token: tokens.super, body: { permissions: { branches: 'view' } } });

        assert.equal((await call('POST', '/v1/branches', { token, body: { ...branch, branchName: 'Second' } })).status, 403,
            'no re-login, no token change — the next request is already refused');
        assert.equal((await call('GET', '/v1/branches', { token })).status, 200, 'and reading still works');
    });
});

// ── What the CMS is told ─────────────────────────────────────────────────────
describe('The permissions an admin is handed', () => {
    test('every signed-in admin can read its own', async () => {
        const { token } = await adminWith('Self', { blogs: 'view', reviews: 'edit' });
        const res = await call('GET', `${BASE}/me/permissions`, { token });

        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.levels.blogs, 'view');
        assert.equal(res.body.data.levels.reviews, 'edit');
        assert.equal(res.body.data.levels.users, 'none');
        assert.ok(res.body.data.permissions.includes('reviews.view'), 'edit implies view here too');
    });

    test('unauthenticated, it says nothing', async () => {
        assert.equal((await call('GET', `${BASE}/me/permissions`)).status, 401);
    });

    test('the catalogue lists the real pages, grouped as the CMS shows them', async () => {
        const res = await call('GET', `${BASE}/catalogue`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);

        const modules = res.body.data.modules.map((m) => m.module);
        assert.ok(modules.includes('Content'), modules.join(','));
        assert.ok(modules.includes('Administration'));

        const pages = res.body.data.modules.flatMap((m) => m.pages.map((p) => p.key));
        for (const expected of ['blogs', 'branches', 'users', 'roles', 'advertisements']) {
            assert.ok(pages.includes(expected), expected);
        }
        assert.deepEqual(res.body.data.levels, ['none', 'view', 'edit']);
    });
});


// -- Handing out access you do not have --------------------------------------
// roles.edit is the power to decide what other people may do. Left unbounded it
// is also the power to decide what you may do, which would make it equivalent
// to every other permission at once.
describe('A role manager cannot grant itself more', () => {
    test('cannot create a role that reaches further than its own', async () => {
        const { token } = await adminWith('Bounded Manager', { roles: 'edit', blogs: 'view' });

        const res = await call('POST', BASE, { token, body: { name: 'Too much', permissions: { blogs: 'edit' } } });
        assert.equal(res.status, 403, res.text);
        assert.match(res.body.message, /your own role does not have/i);
        assert.equal(await Role.countDocuments({ nameKey: 'too much' }), 0);

        const other = await call('POST', BASE, { token, body: { name: 'Other page', permissions: { users: 'view' } } });
        assert.equal(other.status, 403, other.text);
    });

    test('cannot edit the role it is signed in with', async () => {
        const { token, role } = await adminWith('Self Editor', { roles: 'edit', blogs: 'view' });

        const res = await call('PUT', `${BASE}/${role._id}`, {
            token,
            body: { permissions: { roles: 'edit', blogs: 'edit', users: 'edit' } }
        });
        assert.equal(res.status, 403, res.text);
        assert.match(res.body.message, /role you are signed in with/i);

        const stored = await Role.findById(role._id).lean();
        assert.equal(stored.permissions.includes('users.edit'), false, 'nothing was granted');
        assert.equal(stored.permissions.includes('blogs.edit'), false);
    });

    test('cannot raise another role beyond its own reach either', async () => {
        const { token } = await adminWith('Bounded Manager Two', { roles: 'edit', blogs: 'view' });
        const target = (await call('POST', BASE, { token, body: { name: 'Target role', permissions: { blogs: 'view' } } })).body.data.role;

        const res = await call('PUT', `${BASE}/${target._id}`, { token, body: { permissions: { blogs: 'edit' } } });
        assert.equal(res.status, 403, res.text);
        assert.equal((await Role.findById(target._id).lean()).permissions.includes('blogs.edit'), false);
    });

    test('cannot assign an account a role beyond its own reach', async () => {
        const { token } = await adminWith('User Manager', { roles: 'view', users: 'edit', blogs: 'view' });

        const res = await call('POST', '/v1/users', {
            token,
            body: { name: 'New Admin', email: 'escalate@test.local', password: 'Password@123', role: 'editor' }
        });
        assert.equal(res.status, 403, res.text);
        assert.match(res.body.message, /more access than your own/i);
        assert.equal(await Admin.countDocuments({ email: 'escalate@test.local' }), 0);
    });

    test('but may assign a role within its reach', async () => {
        const { token } = await adminWith('Fair Manager', { roles: 'view', users: 'edit', blogs: 'view' });
        const assignable = await roleService.createRole({ name: 'Blogs Reader', permissions: { blogs: 'view' } });

        const res = await call('POST', '/v1/users', {
            token,
            body: { name: 'Fair Hire', email: 'fair-hire@test.local', password: 'Password@123', role: assignable.key }
        });
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.user.role, assignable.key);
    });

    test('a Super Admin keeps full role management', async () => {
        const created = await call('POST', BASE, {
            token: tokens.super,
            body: { name: 'Anything goes', permissions: { users: 'edit', blogs: 'edit', integrations: 'edit' } }
        });
        assert.equal(created.status, 201, created.text);
        assert.equal(created.body.data.role.levels.users, 'edit');

        const raised = await call('PUT', `${BASE}/${created.body.data.role._id}`, {
            token: tokens.super,
            body: { permissions: { users: 'edit', blogs: 'edit', integrations: 'edit', settings: 'edit' } }
        });
        assert.equal(raised.status, 200, raised.text);
        assert.equal(raised.body.data.role.levels.settings, 'edit');
    });
});

// -- Reading a page is a view, changing it is an edit -------------------------
// Two modules had reads sitting behind edit, so a view-only role saw the page
// in the menu and then could not load it.
describe('Reads are views on every page', () => {
    test('users: a view role reads the list and is refused every change', async () => {
        const { token } = await adminWith('Users Reader', { users: 'view' });

        assert.equal((await call('GET', '/v1/users', { token })).status, 200);

        const created = await call('POST', '/v1/users', {
            token, body: { name: 'Nope', email: 'nope@test.local', password: 'Password@123', role: 'content_manager' }
        });
        assert.equal(created.status, 403, created.text);
        assert.equal(await Admin.countDocuments({ email: 'nope@test.local' }), 0);
    });

    test('users: an edit role may reach the management endpoints', async () => {
        const { token } = await adminWith('Users Manager', { users: 'edit' });
        assert.equal((await call('GET', '/v1/users', { token })).status, 200);
    });

    test('API settings: a view role reads the configuration and cannot change it', async () => {
        const { token } = await adminWith('Api Reader', { integrations: 'view' });

        assert.equal((await call('GET', '/v1/gemini/config', { token })).status, 200);
        assert.equal((await call('GET', '/v1/gemini/config/fallbacks', { token })).status, 200);
        assert.equal((await call('GET', '/v1/gemini/pexels/config', { token })).status, 200);

        assert.equal((await call('PUT', '/v1/gemini/config', { token, body: { apiKey: 'x' } })).status, 403);
        assert.equal((await call('DELETE', '/v1/gemini/config/key', { token })).status, 403);
        assert.equal((await call('PUT', '/v1/gemini/config/fallbacks', { token, body: { models: [] } })).status, 403);
    });

    test('Gemini Blogs: a view role reads availability and cannot generate', async () => {
        const { token } = await adminWith('Gemini Reader', { geminiBlogs: 'view' });

        assert.equal((await call('GET', '/v1/gemini/availability', { token })).status, 200);
        assert.equal((await call('POST', '/v1/gemini/blogs/generate', { token, body: { topic: 'x' } })).status, 403);
    });

    test('a role with neither page is refused the reads as well', async () => {
        const { token } = await adminWith('Neither', { blogs: 'view' });
        assert.equal((await call('GET', '/v1/users', { token })).status, 403);
        assert.equal((await call('GET', '/v1/gemini/config', { token })).status, 403);
        assert.equal((await call('GET', '/v1/gemini/availability', { token })).status, 403);
    });
});


// -- The page catalogue is not role-management data --------------------------
// Browser verification found the blocker this covers: the catalogue sat behind
// roles.view, so a role without it could not tell which page it was on, and
// every page therefore offered no controls at all — including pages the role
// held at edit, which the API was happily accepting changes to.
describe('The page catalogue', () => {
    test('is readable by any signed-in admin, whatever their role', async () => {
        const { token } = await adminWith('Catalogue Reader', { blogs: 'edit' });

        const res = await call('GET', `${BASE}/catalogue`, { token });
        assert.equal(res.status, 200, res.text);

        const pages = res.body.data.modules.flatMap((m) => m.pages.map((pg) => pg.key));
        assert.ok(pages.includes('blogs'), pages.join(','));
        assert.ok(pages.includes('roles'), 'the roles page is listed as a page like any other');
        assert.deepEqual(res.body.data.levels, ['none', 'view', 'edit']);
    });

    test('carries page names only — nothing about any role', async () => {
        const { token } = await adminWith('Catalogue Snooper', { blogs: 'view' });
        const res = await call('GET', `${BASE}/catalogue`, { token });

        const raw = res.text;
        // Nothing identifying a role, its permissions, its holders or its key.
        for (const leak of ['permissions', 'isSystem', 'userCount', 'super_admin', 'content_manager', 'nameKey']) {
            assert.equal(raw.includes(leak), false, `catalogue leaked ${leak}`);
        }
        const keys = Object.keys(res.body.data).sort();
        assert.deepEqual(keys, ['levels', 'modules', 'pageKeys']);
    });

    test('still needs a session: it is not public', async () => {
        assert.equal((await call('GET', `${BASE}/catalogue`)).status, 401);
    });

    test('reading it grants nothing — role management stays closed', async () => {
        const { token } = await adminWith('Still Not A Manager', { blogs: 'edit' });
        assert.equal((await call('GET', `${BASE}/catalogue`, { token })).status, 200);

        // The four role-management endpoints remain refused.
        const target = (await call('POST', BASE, { token: tokens.super, body: { name: 'Untouchable' } })).body.data.role;
        assert.equal((await call('GET', BASE, { token })).status, 403);
        assert.equal((await call('GET', `${BASE}/${target._id}`, { token })).status, 403);
        assert.equal((await call('POST', BASE, { token, body: { name: 'Nope' } })).status, 403);
        assert.equal((await call('PUT', `${BASE}/${target._id}`, { token, body: { name: 'Renamed' } })).status, 403);

        assert.equal(await Role.countDocuments({ nameKey: 'nope' }), 0);
        assert.equal((await Role.findById(target._id).lean()).name, 'Untouchable');
    });

    test('a role holding a page at edit can both read the catalogue and use the page', async () => {
        // The exact shape of the reported blocker: blogs at edit, roles at none.
        const { token } = await adminWith('Blogs Only Editor', { blogs: 'edit' });

        const catalogue = await call('GET', `${BASE}/catalogue`, { token });
        assert.equal(catalogue.status, 200, 'the CMS can resolve which page it is on');

        const mine = await call('GET', `${BASE}/me/permissions`, { token });
        assert.equal(mine.status, 200);
        assert.equal(mine.body.data.levels.blogs, 'edit');
        assert.equal(mine.body.data.levels.roles, 'none');

        // And the API agrees the page may be changed.
        assert.equal((await call('GET', '/v1/blogs', { token })).status, 200);
        const created = await call('POST', '/v1/blogs', { token, body: {} });
        assert.notEqual(created.status, 403, 'authorisation allows the mutation; only validation may refuse it');
    });

    test('a view role reads the catalogue and is still refused every mutation', async () => {
        const { token } = await adminWith('Blogs Only Viewer', { blogs: 'view' });

        assert.equal((await call('GET', `${BASE}/catalogue`, { token })).status, 200);
        assert.equal((await call('GET', '/v1/blogs', { token })).status, 200);
        assert.equal((await call('POST', '/v1/blogs', { token, body: {} })).status, 403);
    });

    test('a role without the page is refused it, catalogue or no catalogue', async () => {
        const { token } = await adminWith('No Blogs At All', { branches: 'view' });

        assert.equal((await call('GET', `${BASE}/catalogue`, { token })).status, 200);
        assert.equal((await call('GET', '/v1/blogs', { token })).status, 403);
        assert.equal((await call('POST', '/v1/blogs', { token, body: {} })).status, 403);
    });
});
