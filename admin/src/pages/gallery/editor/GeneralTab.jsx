import { useState, useEffect } from 'react'
import {
  Box, TextField, Button, Stack, Avatar, Typography, Switch, FormControlLabel, CircularProgress
} from '@mui/material'
import { PhotoCamera, Save } from '@mui/icons-material'
import { galleryService } from '../../../services/gallery.service'

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')

const GeneralTab = ({ album, onSaved, showToast }) => {
  const [form, setForm] = useState({
    title: '', slug: '', description: '', isActive: true, displayOrder: 0
  })
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [slugManual, setSlugManual] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (album) {
      setForm({
        title: album.title || '',
        slug: album.slug || '',
        description: album.description || '',
        isActive: album.isActive ?? true,
        displayOrder: album.displayOrder ?? 0
      })
      setCoverPreview(album.coverImage?.url || '')
    }
  }, [album])

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target
    setForm((prev) => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value }
      if (name === 'title' && !slugManual) {
        updated.slug = slugify(value)
      }
      if (name === 'slug') setSlugManual(true)
      return updated
    })
  }

  const handleCoverChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('slug', form.slug)
      fd.append('description', form.description)
      fd.append('isActive', form.isActive)
      fd.append('displayOrder', form.displayOrder)
      if (coverFile) fd.append('coverImage', coverFile)

      await galleryService.updateAlbum(album._id, fd)
      showToast('Album saved successfully')
      setCoverFile(null)
      onSaved()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Stack spacing={3}>
        <TextField
          label="Title"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Slug"
          name="slug"
          value={form.slug}
          onChange={handleChange}
          required
          fullWidth
          size="small"
          helperText="Lowercase, hyphens only (e.g. annual-celebration-2025)"
        />
        <TextField
          label="Description"
          name="description"
          value={form.description}
          onChange={handleChange}
          fullWidth
          multiline
          rows={3}
          size="small"
        />
        <TextField
          label="Display Order"
          name="displayOrder"
          type="number"
          value={form.displayOrder}
          onChange={handleChange}
          size="small"
          sx={{ width: 160 }}
          inputProps={{ min: 0 }}
        />
        <FormControlLabel
          control={<Switch checked={form.isActive} onChange={handleChange} name="isActive" color="success" />}
          label="Active"
        />

        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Cover Image</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            {coverPreview ? (
              <Avatar
                src={coverPreview}
                variant="rounded"
                sx={{ width: 100, height: 100, border: '1px solid', borderColor: 'divider' }}
              />
            ) : (
              <Avatar variant="rounded" sx={{ width: 100, height: 100, bgcolor: 'grey.100' }}>
                <PhotoCamera color="disabled" />
              </Avatar>
            )}
            <Button component="label" variant="outlined" size="small" startIcon={<PhotoCamera />}>
              {coverPreview ? 'Change' : 'Upload'}
              <input type="file" hidden accept="image/*" onChange={handleCoverChange} />
            </Button>
          </Stack>
        </Box>

        <Box>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={handleSave}
            disabled={saving || !form.title || !form.slug}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

export default GeneralTab
