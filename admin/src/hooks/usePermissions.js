import { useAuth } from './useAuth'
import { ROLES } from '../utils/constants'

// Mirrors the server's authorization bands so the UI offers only what the API
// will accept. The server is authoritative — every capability here is enforced
// again in middleware, and hiding a button is never the protection.
//
// Content Manager may view and edit existing content, but not create, delete,
// publish, change status or reorder.
export const usePermissions = () => {
  const { user } = useAuth()
  const role = user?.role

  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  const isEditor = role === ROLES.EDITOR
  const isContentManager = role === ROLES.CONTENT_MANAGER

  const canManage = isSuperAdmin || isEditor

  return {
    role,
    isSuperAdmin,
    isEditor,
    isContentManager,
    // Viewing and editing existing records: all three CMS roles.
    canView: !!role,
    canEdit: !!role,
    // Everything that creates, removes, or changes lifecycle state.
    canCreate: canManage,
    canDelete: canManage,
    canChangeStatus: canManage,
    canPublish: canManage,
    canReorder: canManage,
    canModerate: canManage
  }
}

export default usePermissions
