import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Box, Typography, Avatar
} from '@mui/material'
import { PhotoCamera } from '@mui/icons-material'

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')

const AlbumFormDialog = ({ open, album, onSave, onClose, saving }) => {
  const [form, setForm] = useState({ title: '', slug: '', description: '' })
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (open) {
      if (album) {
        setForm({ title: album.title || '', slug: album.slug || '', description: album.description || '' })
        setCoverPreview(album.coverImage?.url || '')
        setSlugManual(true)
      } else {
        setForm({ title: '', slug: '', description: '' })
        setCoverPreview('')
        setSlugManual(false)
      }
      setCoverFile(null)
    }
  }, [open, album])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const updated = { ...prev, [name]: value }
      if (name === 'title' && !slugManual) {
        updated.slug = slugify(value)
      }
      if (name === 'slug') {
        setSlugManual(true)
      }
      return updated
    })
  }

  const handleCoverChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = () => {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('slug', form.slug)
    fd.append('description', form.description)
    if (coverFile) fd.append('coverImage', coverFile)
    onSave(fd)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{album ? 'Edit Album' : 'New Album'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
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

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Cover Image
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {coverPreview ? (
                <Avatar
                  src={coverPreview}
                  variant="rounded"
                  sx={{ width: 80, height: 80, border: '1px solid', borderColor: 'divider' }}
                />
              ) : (
                <Avatar variant="rounded" sx={{ width: 80, height: 80, bgcolor: 'grey.100' }}>
                  <PhotoCamera color="disabled" />
                </Avatar>
              )}
              <Button component="label" variant="outlined" size="small" startIcon={<PhotoCamera />}>
                {coverPreview ? 'Change' : 'Upload'}
                <input type="file" hidden accept="image/*" onChange={handleCoverChange} />
              </Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !form.title || !form.slug}
        >
          {saving ? 'Saving...' : album ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AlbumFormDialog
