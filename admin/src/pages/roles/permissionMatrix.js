// The rules behind the permission matrix.
//
// The matrix shows two boxes per page, View and Edit, but a role really holds
// one of three levels. These functions are what keeps the two in agreement, so
// a role can never be saved as "may change but may not see".

export const LEVELS = { NONE: 'none', VIEW: 'view', EDIT: 'edit' }

export const isViewChecked = (level) => level === LEVELS.VIEW || level === LEVELS.EDIT
export const isEditChecked = (level) => level === LEVELS.EDIT

// Ticking Edit grants View with it; clearing View clears Edit as well. Neither
// is a UI convenience — the server stores the same pairing, and this is what
// stops the form from offering a state it would refuse.
export const toggleView = (level) => (isViewChecked(level) ? LEVELS.NONE : LEVELS.VIEW)
export const toggleEdit = (level) => (isEditChecked(level) ? LEVELS.VIEW : LEVELS.EDIT)

export const setLevel = (levels, pageKey, level) => ({ ...levels, [pageKey]: level })

// Every page in a module at once, for the module's own header row.
export const setModuleLevel = (levels, pageKeys, level) => {
  const next = { ...levels }
  for (const key of pageKeys) next[key] = level
  return next
}

// A module's header box is ticked when every page in it is at least that far.
export const moduleState = (levels, pageKeys) => {
  const view = pageKeys.filter((k) => isViewChecked(levels[k]))
  const edit = pageKeys.filter((k) => isEditChecked(levels[k]))
  return {
    allView: pageKeys.length > 0 && view.length === pageKeys.length,
    someView: view.length > 0 && view.length < pageKeys.length,
    allEdit: pageKeys.length > 0 && edit.length === pageKeys.length,
    someEdit: edit.length > 0 && edit.length < pageKeys.length
  }
}

// Every page the catalogue knows, defaulting to none, so a page added to the
// server later appears in the form without anything here listing pages.
export const levelsFromCatalogue = (catalogue, existing = {}) => {
  const levels = {}
  for (const group of catalogue?.modules || []) {
    for (const page of group.pages) levels[page.key] = existing[page.key] || LEVELS.NONE
  }
  return levels
}

// Only the pages that are actually granted travel to the server: a role is
// described by what it may reach, not by a list of everything it may not.
export const grantedLevels = (levels) => Object.fromEntries(
  Object.entries(levels || {}).filter(([, level]) => level === LEVELS.VIEW || level === LEVELS.EDIT)
)

export const countGranted = (levels) => {
  const values = Object.values(levels || {})
  return {
    view: values.filter((l) => l === LEVELS.VIEW).length,
    edit: values.filter((l) => l === LEVELS.EDIT).length
  }
}

export const validateRoleForm = (form) => {
  const errors = {}
  const name = String(form?.name || '').trim()
  if (!name) errors.name = 'Role name is required'
  else if (name.length > 60) errors.name = 'Role name must not exceed 60 characters'
  if (String(form?.description || '').trim().length > 250) {
    errors.description = 'Description must not exceed 250 characters'
  }
  return errors
}

// The page a route belongs to, so a page's own permission can be found from
// where the CMS currently is. Longest path first, so /products/categories is
// not mistaken for /products.
export const pageForPath = (catalogue, pathname) => {
  const path = String(pathname || '')
  const pages = (catalogue?.modules || []).flatMap((m) => m.pages).filter((p) => p.path)
  const match = pages
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((p) => path === p.path || path.startsWith(`${p.path}/`))
  return match ? match.key : null
}

export const roleError = (err, fallback) => {
  const status = err?.response?.status
  const message = err?.response?.data?.message
  const field = err?.response?.data?.errors?.[0]?.message

  if (status === 401) return 'Your session has expired. Sign in again to continue.'
  if (status === 403) return 'Your role does not allow this action.'
  if (status === 404) return 'That role no longer exists. The list has been refreshed.'
  if (status === 409) return message || 'A role with this name already exists.'
  if (status === 400) return field || message || fallback
  if (status >= 500) return 'The server could not complete that. Try again in a moment.'
  if (!err?.response) return 'No response from the server. Check your connection and try again.'
  return message || fallback
}
