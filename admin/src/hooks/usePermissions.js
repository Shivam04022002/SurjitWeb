import { useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { PermissionContext } from '../contexts/PermissionContext'
import { useAuth } from './useAuth'
import { ROLES } from '../utils/constants'
import { LEVELS, pageForPath } from '../pages/roles/permissionMatrix'

// What the page currently open allows.
//
// A role holds each page at none, view or edit. This turns the level for the
// page being looked at into the capability flags the CMS pages already ask
// about, so a view-only role sees the page and none of its controls.
//
// The server is authoritative — every capability here is enforced again by the
// API, and hiding a button is never the protection.

export const usePermissionState = () => {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}

// The level a named page is held at, for anything that needs a page other than
// the one currently open — a link, or a menu entry.
export const usePagePermission = (pageKey) => {
  const { levelOf, loading } = usePermissionState()
  const level = levelOf(pageKey)
  return {
    level,
    loading,
    canView: level !== LEVELS.NONE,
    canEdit: level === LEVELS.EDIT
  }
}

export const usePermissions = () => {
  const { user } = useAuth()
  const { levels, catalogue, loading, levelOf } = usePermissionState()
  const { pathname } = useLocation()

  const role = user?.role
  const pageKey = pageForPath(catalogue, pathname)
  const level = pageKey ? levelOf(pageKey) : LEVELS.NONE

  const mayView = level !== LEVELS.NONE
  const mayEdit = level === LEVELS.EDIT

  return {
    role,
    // Kept for the few places that name a role rather than a capability.
    isSuperAdmin: role === ROLES.SUPER_ADMIN,
    isEditor: role === ROLES.EDITOR,
    isContentManager: role === ROLES.CONTENT_MANAGER,

    // The page being looked at, and how much of it this role holds.
    pageKey,
    level,
    levels,
    loading,

    // Reading the page.
    canView: mayView,

    // Everything that changes it. Under this model a page is either read-only
    // or fully editable, so creating, changing, publishing, reordering and
    // deleting all answer to the same permission.
    canEdit: mayEdit,
    canCreate: mayEdit,
    canDelete: mayEdit,
    canChangeStatus: mayEdit,
    canPublish: mayEdit,
    canReorder: mayEdit,
    canModerate: mayEdit
  }
}

export default usePermissions
