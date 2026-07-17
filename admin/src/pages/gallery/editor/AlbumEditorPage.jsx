import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Tabs, Tab, Paper, Button,
  CircularProgress, Breadcrumbs, Link, Chip, Stack
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { galleryService } from '../../../services/gallery.service'
import Toast from '../../../components/Toast'
import GeneralTab from './GeneralTab'
import ImagesTab from './ImagesTab'
import ZipImportTab from './ZipImportTab'

const TAB_LABELS = ['General', 'Images', 'ZIP Import']

const AlbumEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }, [])

  const fetchAlbum = useCallback(async () => {
    try {
      const res = await galleryService.getAlbumById(id)
      setAlbum(res.data.album)
    } catch {
      showToast('Failed to load album', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => { fetchAlbum() }, [fetchAlbum])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!album) {
    return (
      <Container maxWidth="xl" disableGutters>
        <Typography color="error">Album not found.</Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/gallery/albums')} sx={{ mt: 2 }}>
          Back to Albums
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link
            component="button" variant="body2" underline="hover" color="inherit"
            onClick={() => navigate('/gallery/albums')}
          >
            Gallery Albums
          </Link>
          <Typography variant="body2" color="text.primary">{album.title}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/gallery/albums')} variant="outlined" size="small">
              Back
            </Button>
            <Box>
              <Typography variant="h5" fontWeight={700}>{album.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                /{album.slug}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              label={album.isActive ? 'Active' : 'Inactive'}
              color={album.isActive ? 'success' : 'default'}
              size="small"
            />
            <Chip
              label={`${album.imagesCount ?? 0} images`}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': { minWidth: 100, fontWeight: 500 }
          }}
        >
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <GeneralTab album={album} onSaved={fetchAlbum} showToast={showToast} />
          )}
          {activeTab === 1 && (
            <ImagesTab albumId={id} showToast={showToast} />
          )}
          {activeTab === 2 && (
            <ZipImportTab
              albumId={id}
              showToast={showToast}
              onImportComplete={() => {
                fetchAlbum()
                setActiveTab(1)
              }}
            />
          )}
        </Box>
      </Paper>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default AlbumEditorPage
