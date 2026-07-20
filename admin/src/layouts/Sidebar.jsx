import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
  Box,
  Typography,
  Divider,
  Collapse
} from '@mui/material'
import {
  Dashboard,
  AccountCircle,
  Inventory,
  Groups,
  EmojiPeople,
  Work,
  PhotoLibrary,
  PermMedia,
  People,
  Menu as MenuIcon,
  ChevronLeft,
  Info,
  ExpandLess,
  ExpandMore,
  Business,
  SupervisedUserCircle,
  ManageAccounts,
  Category,
  ShoppingBag,
  WorkOutline,
  Tune,
  AssignmentInd,
  Collections,
  Article,
  PostAdd,
  LocalOffer,
  Settings
} from '@mui/icons-material'

const drawerWidth = 260

const menuItems = [
  { title: 'Dashboard', icon: Dashboard, path: '/' },
  {
    title: 'About Us',
    icon: Info,
    path: null,
    children: [
      { title: 'Company Info', icon: Business, path: '/about/company' },
      { title: 'Board of Directors', icon: SupervisedUserCircle, path: '/about/directors' },
      { title: 'Leadership Team', icon: ManageAccounts, path: '/about/leadership' }
    ]
  },
  {
    title: 'Products',
    icon: Inventory,
    path: null,
    children: [
      { title: 'Product Categories', icon: Category, path: '/products/categories' },
      { title: 'Products', icon: ShoppingBag, path: '/products' }
    ]
  },
  {
    title: 'Career',
    icon: WorkOutline,
    path: null,
    children: [
      { title: 'Career Settings', icon: Tune, path: '/career/settings' },
      { title: 'Job Openings', icon: Work, path: '/career/jobs' },
      { title: 'Applications', icon: AssignmentInd, path: '/career/applications' }
    ]
  },
  {
    title: 'Gallery',
    icon: PhotoLibrary,
    path: null,
    children: [
      { title: 'Albums', icon: Collections, path: '/gallery/albums' }
    ]
  },
  {
    title: 'Content',
    icon: Article,
    path: null,
    children: [
      { title: 'All Blogs', icon: Article, path: '/blogs' },
      { title: 'Add Blog', icon: PostAdd, path: '/blogs/new' },
      { title: 'Blog Categories', icon: LocalOffer, path: '/blogs/categories' }
    ]
  },
  { title: 'Media', icon: PermMedia, path: '#' },
  { title: 'Users', icon: People, path: '#' },
  { title: 'Settings', icon: Settings, path: '/settings' },
  { title: 'Profile', icon: AccountCircle, path: '/profile' }
]

const Sidebar = ({ mobileOpen, onDrawerToggle }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [openGroups, setOpenGroups] = useState({ 'About Us': true, Products: true, Career: true, Gallery: true, Content: true })

  const handleNavigation = (path) => {
    if (path && path !== '#') {
      navigate(path)
    }
    if (isMobile) {
      onDrawerToggle()
    }
  }

  const toggleGroup = (title) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          Surjit CMS
        </Typography>
        {isMobile && (
          <IconButton onClick={onDrawerToggle}>
            <ChevronLeft />
          </IconButton>
        )}
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon

          if (item.children) {
            const groupOpen = !!openGroups[item.title]
            const isGroupActive = item.children.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'))
            return (
              <Box key={item.title}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleGroup(item.title)}
                    sx={{
                      bgcolor: isGroupActive ? 'rgba(26, 35, 126, 0.06)' : 'transparent'
                    }}
                  >
                    <ListItemIcon>
                      <Icon color={isGroupActive ? 'primary' : 'inherit'} />
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                    {groupOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const childSelected = location.pathname === child.path
                      return (
                        <ListItem key={child.title} disablePadding>
                          <ListItemButton
                            selected={childSelected}
                            onClick={() => handleNavigation(child.path)}
                            sx={{
                              pl: 4,
                              '&.Mui-selected': {
                                backgroundColor: 'rgba(26, 35, 126, 0.12)',
                                '&:hover': { backgroundColor: 'rgba(26, 35, 126, 0.18)' }
                              }
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <ChildIcon fontSize="small" color={childSelected ? 'primary' : 'inherit'} />
                            </ListItemIcon>
                            <ListItemText
                              primary={child.title}
                              primaryTypographyProps={{ fontSize: '0.875rem' }}
                            />
                          </ListItemButton>
                        </ListItem>
                      )
                    })}
                  </List>
                </Collapse>
              </Box>
            )
          }

          const selected = location.pathname === item.path
          return (
            <ListItem key={item.title} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(26, 35, 126, 0.12)',
                    '&:hover': {
                      backgroundColor: 'rgba(26, 35, 126, 0.18)'
                    }
                  }
                }}
              >
                <ListItemIcon>
                  <Icon color={selected ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </Box>
  )
}

export default Sidebar
