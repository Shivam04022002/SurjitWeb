import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Typography, Button, Stack, Alert, Tabs, Tab } from '@mui/material'
import { AutoAwesome, Article, UploadFile } from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import { blogService } from '../../services/blog.service'
import { usePermissions, usePagePermission } from '../../hooks/usePermissions'
import Toast from '../../components/Toast'
import SingleBlogTab from './SingleBlogTab'
import BulkUploadTab from './BulkUploadTab'
import { errorMessage } from './geminiBlogUtils'

// Gemini Blogs: one blog at a time, or a month's plan from Excel. Both tabs
// use the same generation list, backend endpoints, editor and draft save; the
// page only holds what they share (configuration, categories, toasts).
const GeminiBlogsPage = () => {
  const navigate = useNavigate()
  const { canCreate } = usePermissions()
  // Whether this admin can reach the page where the key is configured.
  const apiSettings = usePagePermission('integrations')

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
          Generate blogs with Google Gemini — one at a time, or a month's plan from Excel. Every blog is
          saved as a draft; nothing is published automatically.
        </Typography>
      </Box>

      <Tabs
        value={mode}
        onChange={(e, v) => setMode(v)}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider', minHeight: 44, '& .MuiTab-root': { minHeight: 44 } }}
      >
        <Tab value="single" icon={<Article fontSize="small" />} iconPosition="start" label="Single Blog" />
        <Tab value="bulk" icon={<UploadFile fontSize="small" />} iconPosition="start" label="Bulk Upload" />
      </Tabs>

      {availabilityError && <Alert severity="error" sx={{ mb: 3 }}>{availabilityError}</Alert>}
      {notConfigured && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={apiSettings.canView && <Button color="inherit" size="small" onClick={() => navigate('/integrations/api')}>Open API</Button>}
        >
          Gemini is not configured yet. {apiSettings.canEdit ? 'Add the API key on the API page.' : 'Ask an administrator with API access to add the key.'}
        </Alert>
      )}

      {/* Both stay mounted, so switching modes never discards work in progress. */}
      <Box sx={{ display: mode === 'single' ? 'block' : 'none' }}>
        <SingleBlogTab availability={availability} categories={categories} showToast={showToast} />
      </Box>
      <Box sx={{ display: mode === 'bulk' ? 'block' : 'none' }}>
        <BulkUploadTab availability={availability} categories={categories} showToast={showToast} />
      </Box>

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default GeminiBlogsPage
