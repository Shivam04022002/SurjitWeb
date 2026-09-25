import { createContext, useState, useEffect, useCallback, useMemo } from 'react'
import { roleService } from '../services/role.service'
import { PERMISSIONS_STALE } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { LEVELS } from '../pages/roles/permissionMatrix'

export const PermissionContext = createContext(null)

// What the signed-in admin may reach, fetched from the same place the API
// enforces. The CMS draws its menu, its routes and its buttons from this — but
// none of that is the control: every one of those actions is refused by the
// server as well, and hiding a button only spares an administrator a 403.
export const PermissionProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [levels, setLevels] = useState({})
  const [catalogue, setCatalogue] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setLevels({})
      setCatalogue(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const mine = await roleService.getMyPermissions()
      setLevels(mine.data.levels || {})
    } catch {
      // No permissions rather than a broken CMS: every page then reads as
      // inaccessible, which is what the server would say anyway.
      setLevels({})
    }

    // The page list is only needed by someone who can see the roles page, and
    // to resolve a route to a page. A refusal here is not an error.
    try {
      const cat = await roleService.getPermissionCatalogue()
      setCatalogue(cat.data)
    } catch {
      setCatalogue(null)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!authLoading) refresh()
  }, [authLoading, refresh])

  // Two moments worth re-reading at: the server refused something this session
  // thought it could do, and the administrator came back to the tab. Neither is
  // a timer — a permission change is rare, and the server is what enforces it
  // in the meantime.
  useEffect(() => {
    if (!isAuthenticated) return

    const onStale = () => refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }

    window.addEventListener(PERMISSIONS_STALE, onStale)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(PERMISSIONS_STALE, onStale)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthenticated, refresh])

  const value = useMemo(() => {
    const levelOf = (pageKey) => levels[pageKey] || LEVELS.NONE
    return {
      levels,
      catalogue,
      loading: loading || authLoading,
      refresh,
      levelOf,
      canView: (pageKey) => levelOf(pageKey) !== LEVELS.NONE,
      canEdit: (pageKey) => levelOf(pageKey) === LEVELS.EDIT
    }
  }, [levels, catalogue, loading, authLoading, refresh])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}
