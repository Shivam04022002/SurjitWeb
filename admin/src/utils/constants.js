export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  EDITOR: 'editor',
  CONTENT_MANAGER: 'content_manager'
}

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.EDITOR]: 'Editor',
  [ROLES.CONTENT_MANAGER]: 'Content Manager'
}

export const TEAM_TYPES = {
  LEADERSHIP: 'leadership',
  BOARD: 'board'
}

export const TEAM_TYPE_OPTIONS = [
  { value: TEAM_TYPES.LEADERSHIP, label: 'Leadership Team' },
  { value: TEAM_TYPES.BOARD, label: 'Board of Directors' }
]

export const DASHBOARD_CARDS = [
  { title: 'About Us', icon: 'Info', path: '/about/company' },
  { title: 'Products', icon: 'Inventory', path: '/products' },
  { title: 'Career', icon: 'WorkOutline', path: '/career/jobs' },
  { title: 'Gallery', icon: 'PhotoLibrary', path: '/gallery/albums' },
  { title: 'Media', icon: 'PermMedia', path: '#' },
  { title: 'Users', icon: 'People', path: '/users' },
  { title: 'Settings', icon: 'Settings', path: '/settings' }
]
