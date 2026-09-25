// The rules the permission matrix is built on.
//
// The form shows two boxes per page; a role stores one of three levels. These
// tests are about the pairing between them — above all that a role can never be
// put into the state "may change but may not see", which the server refuses.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
    LEVELS, isViewChecked, isEditChecked, toggleView, toggleEdit,
    setLevel, setModuleLevel, moduleState, levelsFromCatalogue,
    grantedLevels, countGranted, validateRoleForm, pageForPath, roleError
} from './permissionMatrix.js'

const CATALOGUE = {
    modules: [
        { module: 'Content', pages: [
            { key: 'blogs', label: 'Blogs', path: '/blogs' },
            { key: 'blogCategories', label: 'Blog Categories', path: '/blogs/categories' },
            { key: 'branches', label: 'Branches', path: '/branches' }
        ] },
        { module: 'Administration', pages: [
            { key: 'users', label: 'CMS Users', path: '/users' },
            { key: 'roles', label: 'Roles & Permissions', path: '/roles' }
        ] }
    ]
}

describe('what the boxes show', () => {
    test('view is ticked for view and for edit', () => {
        assert.equal(isViewChecked(LEVELS.NONE), false)
        assert.equal(isViewChecked(LEVELS.VIEW), true)
        assert.equal(isViewChecked(LEVELS.EDIT), true, 'edit implies view')
    })

    test('edit is ticked only for edit', () => {
        assert.equal(isEditChecked(LEVELS.NONE), false)
        assert.equal(isEditChecked(LEVELS.VIEW), false)
        assert.equal(isEditChecked(LEVELS.EDIT), true)
    })
})

describe('ticking the boxes', () => {
    test('ticking edit grants view with it', () => {
        assert.equal(toggleEdit(LEVELS.NONE), LEVELS.EDIT)
        assert.equal(isViewChecked(toggleEdit(LEVELS.NONE)), true)
    })

    test('unticking edit leaves view behind', () => {
        assert.equal(toggleEdit(LEVELS.EDIT), LEVELS.VIEW)
    })

    test('unticking view removes edit as well', () => {
        // The state this prevents is edit without view, which cannot be stored.
        assert.equal(toggleView(LEVELS.EDIT), LEVELS.NONE)
        assert.equal(toggleView(LEVELS.VIEW), LEVELS.NONE)
    })

    test('ticking view alone grants only view', () => {
        assert.equal(toggleView(LEVELS.NONE), LEVELS.VIEW)
        assert.equal(isEditChecked(toggleView(LEVELS.NONE)), false)
    })

    test('no sequence of clicks can produce edit without view', () => {
        let level = LEVELS.NONE
        const clicks = [toggleView, toggleEdit, toggleEdit, toggleView, toggleEdit, toggleView, toggleView]
        for (const click of clicks) {
            level = click(level)
            if (isEditChecked(level)) assert.equal(isViewChecked(level), true, `edit without view after ${click.name}`)
        }
    })

    test('one page changes without disturbing the others', () => {
        const levels = { blogs: LEVELS.VIEW, branches: LEVELS.EDIT }
        const next = setLevel(levels, 'blogs', LEVELS.EDIT)
        assert.equal(next.blogs, LEVELS.EDIT)
        assert.equal(next.branches, LEVELS.EDIT)
        assert.equal(levels.blogs, LEVELS.VIEW, 'the previous state is not mutated')
    })
})

describe('a whole module at once', () => {
    const pageKeys = ['blogs', 'blogCategories', 'branches']

    test('setting every page to view', () => {
        const next = setModuleLevel({}, pageKeys, LEVELS.VIEW)
        assert.deepEqual(next, { blogs: 'view', blogCategories: 'view', branches: 'view' })
    })

    test('the header box reads all, some or none', () => {
        assert.deepEqual(
            moduleState({ blogs: 'view', blogCategories: 'view', branches: 'view' }, pageKeys),
            { allView: true, someView: false, allEdit: false, someEdit: false }
        )
        const partial = moduleState({ blogs: 'edit', blogCategories: 'none', branches: 'none' }, pageKeys)
        assert.equal(partial.someView, true)
        assert.equal(partial.allView, false)
        assert.equal(partial.someEdit, true)
    })

    test('clearing a module of edit leaves it at view', () => {
        const next = setModuleLevel({ blogs: 'edit', branches: 'edit' }, pageKeys, LEVELS.VIEW)
        assert.ok(pageKeys.every((k) => next[k] === LEVELS.VIEW))
    })
})

describe('what the form starts from and sends', () => {
    test('every page in the catalogue appears, defaulting to none', () => {
        const levels = levelsFromCatalogue(CATALOGUE)
        assert.deepEqual(Object.keys(levels).sort(), ['blogCategories', 'blogs', 'branches', 'roles', 'users'])
        assert.ok(Object.values(levels).every((l) => l === LEVELS.NONE))
    })

    test('the levels of an existing role are carried in', () => {
        const levels = levelsFromCatalogue(CATALOGUE, { blogs: 'edit', users: 'view' })
        assert.equal(levels.blogs, 'edit')
        assert.equal(levels.users, 'view')
        assert.equal(levels.branches, 'none')
    })

    test('a page the catalogue does not list is not invented', () => {
        const levels = levelsFromCatalogue(CATALOGUE, { payroll: 'edit' })
        assert.equal('payroll' in levels, false)
    })

    test('only granted pages are sent', () => {
        const granted = grantedLevels({ blogs: 'edit', users: 'view', branches: 'none', roles: 'none' })
        assert.deepEqual(granted, { blogs: 'edit', users: 'view' })
    })

    test('the counts shown on the list', () => {
        assert.deepEqual(countGranted({ blogs: 'edit', branches: 'edit', users: 'view', roles: 'none' }), { view: 1, edit: 2 })
        assert.deepEqual(countGranted({}), { view: 0, edit: 0 })
    })
})

describe('the role form', () => {
    test('a name is required and capped', () => {
        assert.equal(validateRoleForm({ name: 'HR Reviewer' }).name, undefined)
        assert.equal(validateRoleForm({ name: '   ' }).name, 'Role name is required')
        assert.match(validateRoleForm({ name: 'x'.repeat(61) }).name, /60/)
    })

    test('the description is capped', () => {
        assert.match(validateRoleForm({ name: 'Ok', description: 'x'.repeat(251) }).description, /250/)
        assert.equal(validateRoleForm({ name: 'Ok', description: 'x'.repeat(250) }).description, undefined)
    })
})

describe('finding the page a route belongs to', () => {
    test('an exact path and a path beneath it', () => {
        assert.equal(pageForPath(CATALOGUE, '/branches'), 'branches')
        assert.equal(pageForPath(CATALOGUE, '/blogs'), 'blogs')
        assert.equal(pageForPath(CATALOGUE, '/blogs/new'), 'blogs')
    })

    test('the longer path wins, so a sub-page is not mistaken for its parent', () => {
        assert.equal(pageForPath(CATALOGUE, '/blogs/categories'), 'blogCategories')
    })

    test('an unknown route belongs to no page', () => {
        assert.equal(pageForPath(CATALOGUE, '/'), null)
        assert.equal(pageForPath(CATALOGUE, '/profile'), null)
        assert.equal(pageForPath(null, '/blogs'), null)
    })
})

describe('error messages', () => {
    const withStatus = (status, data = {}) => ({ response: { status, data } })

    test('a duplicate name reads as one', () => {
        assert.match(roleError(withStatus(409, { message: 'A role with this name already exists' }), 'x'), /already exists/)
    })

    test('the lifecycle statuses read as something an admin can act on', () => {
        assert.match(roleError(withStatus(403), 'x'), /role does not allow/i)
        assert.match(roleError(withStatus(401), 'x'), /sign in/i)
        assert.match(roleError(withStatus(404), 'x'), /no longer exists/i)
        assert.match(roleError(withStatus(500), 'x'), /try again/i)
        assert.match(roleError(new Error('Network Error'), 'x'), /connection/i)
    })

    test('a field error is preferred over the generic one', () => {
        const err = withStatus(400, { message: 'Validation failed', errors: [{ message: 'Role name is required' }] })
        assert.equal(roleError(err, 'fallback'), 'Role name is required')
    })
})
