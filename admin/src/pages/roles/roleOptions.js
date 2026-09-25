import { LEVELS } from './permissionMatrix.js'

// Which roles an administrator may put someone into.
//
// The list comes from the roles API, so a role created on the Roles page can
// be assigned the moment it exists — nothing here knows the names of the roles
// the CMS shipped with.

// An inactive role grants nothing, so offering it would be offering an account
// that cannot do anything.
const isAssignable = (role) => role && role.status === 'Active'

// Nobody hands out more reach than they hold themselves. Super Admin is exempt
// — it holds everything, so the comparison can only ever pass. The server
// applies the same rule; this keeps the menu honest rather than enforcing it.
const withinReach = (role, actorPermissions) => {
  const held = new Set(actorPermissions || [])
  return (role.permissions || []).every((permission) => held.has(permission))
}

export const assignableRoles = (roles, { isSuperAdmin = false, permissions = [] } = {}) => {
  const active = (roles || []).filter(isAssignable)
  if (isSuperAdmin) return active
  return active.filter((role) => role.key !== 'super_admin' && withinReach(role, permissions))
}

export const roleLabel = (role, fallbackLabels = {}) => (
  role?.name || fallbackLabels[role?.key] || role?.key || ''
)

// The label for a role key when the roles list has not arrived, or the key
// belongs to a role that has since been renamed or removed. A user's own role
// is still shown as something readable rather than as a blank.
export const roleLabelForKey = (key, roles, fallbackLabels = {}) => {
  const role = (roles || []).find((r) => r.key === key)
  return role ? role.name : (fallbackLabels[key] || key || '—')
}

// A short description of what a role reaches, for the form's helper line.
export const roleSummary = (role) => {
  if (!role) return ''
  if (role.key === 'super_admin') return 'Full access to every page, including roles'

  const levels = Object.values(role.levels || {})
  const edit = levels.filter((l) => l === LEVELS.EDIT).length
  const view = levels.filter((l) => l === LEVELS.VIEW).length

  if (!edit && !view) return 'No pages yet — this user would see only the dashboard'
  if (!edit) return `Read-only access to ${view} page${view === 1 ? '' : 's'}`
  if (!view) return `Can change ${edit} page${edit === 1 ? '' : 's'}`
  return `Can change ${edit} page${edit === 1 ? '' : 's'}, and read ${view} more`
}

// The colour a role's chip takes in the list. Named roles keep the colours the
// CMS has always used; a custom role gets the neutral one.
export const roleColour = (key) => {
  if (key === 'super_admin') return 'error'
  if (key === 'editor') return 'primary'
  return 'default'
}
