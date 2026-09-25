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
  RequestQuote,
  BarChart,
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
  RateReview,
  Description,
  Place,
  Insights,
  Gavel,
  SupportAgent,
  Settings,
  AutoAwesome,
  Campaign,
  AdminPanelSettings,
  Api
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { usePermissionState } from '../hooks/usePermissions'

const drawerWidth = 260

const menuItems = [
  { title: 'Dashboard', icon: Dashboard, path: '/' },
  {
    title: 'About Us',
    icon: Info,
    path: null,
    children: [
      { title: 'Company Info', icon: Business, path: '/about/company', page: 'company' },
      { title: 'Board of Directors', icon: SupervisedUserCircle, path: '/about/directors', page: 'directors' },
      { title: 'Leadership Team', icon: ManageAccounts, path: '/about/leadership', page: 'leadership' }
    ]
  },
  {
    title: 'Products',
    icon: Inventory,
    path: null,
    children: [
      { title: 'Product Categories', icon: Category, path: '/products/categories', page: 'productCategories' },
      { title: 'Products', icon: ShoppingBag, path: '/products', page: 'products' }
    ]
  },
  {
    title: 'Career',
    icon: WorkOutline,
    path: null,
    children: [
      { title: 'Career Settings', icon: Tune, path: '/career/settings', page: 'careerSettings' },
      { title: 'Job Openings', icon: Work, path: '/career/jobs', page: 'jobs' },
      { title: 'Applications', icon: AssignmentInd, path: '/career/applications', page: 'jobApplications' }
    ]
  },
  {
    title: 'Gallery',
    icon: PhotoLibrary,
    path: null,
    children: [
      { title: 'Albums', icon: Collections, path: '/gallery/albums', page: 'gallery' }
    ]
  },
  {
    title: 'Content',
    icon: Article,
    path: null,
    children: [
      { title: 'All Blogs', icon: Article, path: '/blogs', page: 'blogs' },
      { title: 'Add Blog', icon: PostAdd, path: '/blogs/new', page: 'blogs' },
      { title: 'Blog Categories', icon: LocalOffer, path: '/blogs/categories', page: 'blogCategories' },
      { title: 'Customer Reviews', icon: RateReview, path: '/reviews', page: 'reviews' },
      { title: 'Annual Reports', icon: Description, path: '/reports', page: 'reports' },
      { title: 'Branches', icon: Place, path: '/branches', page: 'branches' },
      { title: 'Homepage Statistics', icon: Insights, path: '/homepage-stats', page: 'homepageStats' },
      { title: 'Legal Pages', icon: Gavel, path: '/legal-pages', page: 'legalPages' },
      { title: 'Nodal Officers', icon: SupportAgent, path: '/nodal-officers', page: 'nodalOfficers' }
    ]
  },
  // `page` names the permission an entry needs. An entry without one is shown
  // to everyone — the dashboard and the visitor's own profile.
  { title: 'Gemini Blogs', icon: AutoAwesome, path: '/gemini-blogs', page: 'geminiBlogs' },
  { title: 'Advertisements', icon: Campaign, path: '/advertisements', page: 'advertisements' },
  { title: 'Roles & Permissions', icon: AdminPanelSettings, path: '/roles', page: 'roles' },
  { title: 'Loan Applications', icon: RequestQuote, path: '/loan-applications', page: 'loanApplications' },
  { title: 'Website Analytics', icon: BarChart, path: '/analytics', page: 'analytics' },
  { title: 'Media', icon: PermMedia, path: '#' },
  { title: 'Users', icon: People, path: '/users', page: 'users' },
  { title: 'API', icon: Api, path: '/integrations/api', page: 'integrations' },
  { title: 'Settings', icon: Settings, path: '/settings', page: 'settings' },
  { title: 'Profile', icon: AccountCircle, path: '/profile' }
]

const Sidebar = ({ mobileOpen, onDrawerToggle }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { canView } = usePermissionState()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [openGroups, setOpenGroups] = useState({ 'About Us': true, Products: true, Career: true, Gallery: true, Content: true })

  // A page a role cannot open is not offered. A group disappears once every
  // page inside it has gone, rather than opening onto nothing.
  const allowed = (item) => !item.page || canView(item.page)
  const visibleItems = menuItems
    .map((item) => (item.children ? { ...item, children: item.children.filter(allowed) } : item))
    .filter((item) => (item.children ? item.children.length > 0 : allowed(item)))

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
        {visibleItems.map((item) => {
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
