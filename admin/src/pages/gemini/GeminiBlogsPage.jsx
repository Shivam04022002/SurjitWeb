import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Typography, Button, Stack, Alert, Tabs, Tab } from '@mui/material'
import { AutoAwesome, Article, CalendarMonth } from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import { blogService } from '../../services/blog.service'
import { usePermissions } from '../../hooks/usePermissions'
import Toast from '../../components/Toast'
import SingleBlogPanel from './SingleBlogPanel'
import MonthlyBlogsPanel from './MonthlyBlogsPanel'
import { errorMessage } from './geminiBlogUtils'

// Gemini Blogs: one blog at a time, or a month's worth. Both modes use the
// same backend endpoints, editor and draft save; the page only holds what they
// share (configuration status, categories, toasts) and the mode switch.
const GeminiBlogsPage = () => {
  const navigate = useNavigate()
  const { canCreate, isSuperAdmin } = usePermissions()

  const [mode, setMode] = useState('single')
  const [availability, setAvailability] = useState(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [categories, setCategories] = useState([])
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => setToast({ open: true, message, severity }), [])

  useEffect(() => {
    if (!canCreate) return
    geminiService.getAvailability()
      .then((res) => setAvailability(res.data.availability))
      .catch((err) => setAvailabilityError(errorMessage(err, 'Could not check the Gemini configuration.')))
    blogService.getAllCategories()
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {})
  }, [canCreate])

  if (!canCreate) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Gemini Blogs</Typography>
        <Alert severity="info">Only Super Admins and Editors can generate blogs.</Alert>
      </Container>
    )
  }

  const notConfigured = availability && !availability.configured

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesome color="primary" />
          <Typography variant="h5" fontWeight={700}>Gemini Blogs</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Generate blog drafts with Google Gemini, review them, then save them as drafts.
          Nothing is published automatically.
        </Typography>
      </Box>

      <Tabs
        value={mode}
        onChange={(e, v) => setMode(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="single" icon={<Article fontSize="small" />} iconPosition="start" label="Single Blog" />
        <Tab value="monthly" icon={<CalendarMonth fontSize="small" />} iconPosition="start" label="Monthly Blogs" />
      </Tabs>

      {availabilityError && <Alert severity="error" sx={{ mb: 3 }}>{availabilityError}</Alert>}
      {notConfigured && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={isSuperAdmin && <Button color="inherit" size="small" onClick={() => navigate('/integrations/api')}>Open API</Button>}
        >
          Gemini is not configured yet. {isSuperAdmin ? 'Add the API key on the API page.' : 'Ask a Super Admin to add the API key on the API page.'}
        </Alert>
      )}

      {/* Both stay mounted, so switching modes never discards work in progress. */}
      <Box sx={{ display: mode === 'single' ? 'block' : 'none' }}>
        <SingleBlogPanel availability={availability} categories={categories} showToast={showToast} />
      </Box>
      <Box sx={{ display: mode === 'monthly' ? 'block' : 'none' }}>
        <MonthlyBlogsPanel availability={availability} categories={categories} showToast={showToast} />
      </Box>

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default GeminiBlogsPage
