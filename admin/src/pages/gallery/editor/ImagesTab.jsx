import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, Button, Grid, Card, CardMedia, CardContent, CardActions,
  TextField, IconButton, Tooltip, Chip, Stack, CircularProgress, Paper
} from '@mui/material'
import {
  CloudUpload, Delete, CheckCircle, Cancel, Save, DragIndicator
} from '@mui/icons-material'
import { galleryService } from '../../../services/gallery.service'

const ImagesTab = ({ albumId, showToast }) => {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ caption: '', altText: '' })
  const [savingId, setSavingId] = useState(null)
  const fileInputRef = useRef(null)

  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await galleryService.getImagesByAlbum(albumId)
      setImages(res.data.images)
    } catch {
      showToast('Failed to load images', 'error')
    } finally {
      setLoading(false)
    }
  }, [albumId, showToast])

  useEffect(() => { fetchImages() }, [fetchImages])

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    setUploading(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('images', f))
      await galleryService.uploadImages(albumId, fd)
      showToast(`${files.length} image(s) uploaded successfully`)
      fetchImages()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleEditStart = (image) => {
    setEditingId(image._id)
    setEditForm({ caption: image.caption || '', altText: image.altText || '' })
  }

  const handleEditSave = async (id) => {
    setSavingId(id)
    try {
      await galleryService.updateImage(id, editForm)
      showToast('Image updated successfully')
      setEditingId(null)
      fetchImages()
    } catch {
      showToast('Failed to update image', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await galleryService.toggleImageStatus(id)
      fetchImages()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this image? This cannot be undone.')) return
    try {
      await galleryService.deleteImage(id)
      showToast('Image deleted')
      fetchImages()
    } catch {
      showToast('Failed to delete image', 'error')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Upload Bar */}
      <Paper
        variant="outlined"
        sx={{
          p: 3, mb: 3, borderRadius: 2, borderStyle: 'dashed',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          bgcolor: 'grey.50', cursor: 'pointer',
          '&:hover': { bgcolor: 'grey.100' }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
        />
        {uploading ? (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">Uploading...</Typography>
          </>
        ) : (
          <>
            <CloudUpload sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="body1" fontWeight={500}>Click to upload images</Typography>
            <Typography variant="caption" color="text.secondary">
              JPG, JPEG, PNG, WEBP · Max 15 MB per image · Multiple selection supported
            </Typography>
            <Button variant="contained" size="small" startIcon={<CloudUpload />} sx={{ mt: 1 }}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
              Choose Files
            </Button>
          </>
        )}
      </Paper>

      {/* Images count */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary">
          {images.length} image{images.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {images.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">No images in this album yet. Upload some above.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {images.map((image) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={image._id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={image.image.url}
                    alt={image.altText || image.caption || 'Gallery image'}
                    sx={{ objectFit: 'cover', bgcolor: 'grey.100' }}
                  />
                  <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
                    <Chip
                      label={image.isActive ? 'Active' : 'Inactive'}
                      color={image.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>

                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  {editingId === image._id ? (
                    <Stack spacing={1}>
                      <TextField
                        label="Caption"
                        value={editForm.caption}
                        onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                        size="small"
                        fullWidth
                        inputProps={{ maxLength: 500 }}
                      />
                      <TextField
                        label="Alt Text"
                        value={editForm.altText}
                        onChange={(e) => setEditForm((f) => ({ ...f, altText: e.target.value }))}
                        size="small"
                        fullWidth
                        inputProps={{ maxLength: 300 }}
                      />
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" noWrap title={image.caption}>
                        {image.caption || <span style={{ color: '#999', fontStyle: 'italic' }}>No caption</span>}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap title={image.altText}>
                        Alt: {image.altText || '—'}
                      </Typography>
                    </Stack>
                  )}
                </CardContent>

                <CardActions sx={{ pt: 0, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  {editingId === image._id ? (
                    <>
                      <Button size="small" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button
                        size="small" variant="contained"
                        startIcon={savingId === image._id ? <CircularProgress size={14} /> : <Save />}
                        onClick={() => handleEditSave(image._id)}
                        disabled={savingId === image._id}
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tooltip title={image.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton size="small" color={image.isActive ? 'success' : 'default'} onClick={() => handleToggleStatus(image._id)}>
                          {image.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Button size="small" onClick={() => handleEditStart(image)}>Edit</Button>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(image._id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default ImagesTab
