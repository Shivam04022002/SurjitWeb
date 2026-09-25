// Which roles the Users page offers, and what it calls them.
//
// The list used to be three hard-coded constants, so a role created on the
// Roles page could never be assigned to anyone. It now comes from the roles
// API, with two rules: the role must be active, and it must not reach further
// than the administrator doing the assigning. The server applies both again.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { assignableRoles, roleLabelForKey, roleSummary, roleColour } from './roleOptions.js'

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    editor: 'Editor',
    content_manager: 'Content Manager'
}

const role = (key, name, permissions, status = 'Active') => ({
    _id: key, key, name, status, permissions,
    levels: permissions.reduce((acc, p) => {
        const [page, level] = p.split('.')
        acc[page] = level === 'edit' ? 'edit' : (acc[page] || 'view')
        return acc
    }, {})
})

const SUPER = role('super_admin', 'Super Admin', ['blogs.view', 'blogs.edit', 'users.view', 'users.edit'])
const EDITOR = role('editor', 'Editor', ['blogs.view', 'blogs.edit'])
const READER = role('content_manager', 'Content Manager', ['blogs.view'])
const CUSTOM = role('hr_reviewer', 'HR Reviewer', ['blogs.view', 'reviews.view', 'reviews.edit'])
const RETIRED = role('old_role', 'Retired Role', ['blogs.view'], 'Inactive')

const ALL = [SUPER, EDITOR, READER, CUSTOM, RETIRED]

describe('which roles may be assigned', () => {
    test('a Super Admin may assign every active role, including the legacy ones', () => {
        const options = assignableRoles(ALL, { isSuperAdmin: true })
        const keys = options.map((r) => r.key)
        assert.ok(keys.includes('super_admin'), 'legacy roles are not removed')
        assert.ok(keys.includes('editor'))
        assert.ok(keys.includes('content_manager'))
        assert.ok(keys.includes('hr_reviewer'), 'a custom role can be assigned')
    })

    test('an inactive role is never offered', () => {
        for (const actor of [{ isSuperAdmin: true }, { permissions: ['blogs.view'] }]) {
            assert.equal(assignableRoles(ALL, actor).some((r) => r.key === 'old_role'), false)
        }
    })

    test('an administrator is not offered a role that reaches further than their own', () => {
        // Holds blogs at view only.
        const options = assignableRoles(ALL, { permissions: ['blogs.view'] })
        const keys = options.map((r) => r.key)

        assert.deepEqual(keys, ['content_manager'], keys.join(','))
        assert.equal(keys.includes('editor'), false, 'editor holds blogs.edit')
        assert.equal(keys.includes('super_admin'), false)
        assert.equal(keys.includes('hr_reviewer'), false, 'the custom role holds reviews')
    })

    test('an administrator may assign a role equal to their own reach', () => {
        const options = assignableRoles(ALL, { permissions: ['blogs.view', 'blogs.edit'] })
        assert.ok(options.some((r) => r.key === 'editor'))
        assert.ok(options.some((r) => r.key === 'content_manager'), 'and anything smaller')
    })

    test('a custom role becomes assignable once the administrator holds its pages', () => {
        const options = assignableRoles(ALL, {
            permissions: ['blogs.view', 'reviews.view', 'reviews.edit']
        })
        assert.ok(options.some((r) => r.key === 'hr_reviewer'))
    })

    test('Super Admin is never offered by a non-Super-Admin, whatever they hold', () => {
        const options = assignableRoles(ALL, { permissions: SUPER.permissions })
        assert.equal(options.some((r) => r.key === 'super_admin'), false)
    })

    test('no roles at all is an empty list, not a crash', () => {
        assert.deepEqual(assignableRoles([], { isSuperAdmin: true }), [])
        assert.deepEqual(assignableRoles(null, {}), [])
        assert.deepEqual(assignableRoles(undefined, undefined), [])
    })
})

describe('what a role is called', () => {
    test('the role name from the API wins', () => {
        assert.equal(roleLabelForKey('hr_reviewer', ALL, ROLE_LABELS), 'HR Reviewer')
        assert.equal(roleLabelForKey('editor', ALL, ROLE_LABELS), 'Editor')
    })

    test('a key with no matching role falls back to the legacy label, then to the key', () => {
        assert.equal(roleLabelForKey('editor', [], ROLE_LABELS), 'Editor', 'labels are preserved')
        assert.equal(roleLabelForKey('unknown_role', [], ROLE_LABELS), 'unknown_role')
        assert.equal(roleLabelForKey('', [], ROLE_LABELS), '—')
    })

    test('the chip colour keeps the CMS conventions and is neutral for a custom role', () => {
        assert.equal(roleColour('super_admin'), 'error')
        assert.equal(roleColour('editor'), 'primary')
        assert.equal(roleColour('content_manager'), 'default')
        assert.equal(roleColour('hr_reviewer'), 'default')
    })
})

describe('what a role reaches, in a sentence', () => {
    test('Super Admin is described as everything', () => {
        assert.match(roleSummary(SUPER), /every page/i)
    })

    test('a read-only role says so', () => {
        assert.match(roleSummary(READER), /read-only access to 1 page/i)
    })

    test('a mixed role counts both', () => {
        assert.match(roleSummary(CUSTOM), /change 1 page.*read 1 more/i)
    })

    test('a role with nothing says what that means', () => {
        assert.match(roleSummary(role('empty', 'Empty', [])), /no pages yet/i)
    })

    test('no role at all is an empty string', () => {
        assert.equal(roleSummary(null), '')
        assert.equal(roleSummary(undefined), '')
    })
})
