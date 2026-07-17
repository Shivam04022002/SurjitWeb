import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Box, Typography, CircularProgress
} from '@mui/material'
import ImageUpload from '../../components/ImageUpload'

const defaultForm = {
  name: '',
  slug: '',
  shortDescription: '',
  displayOrder: '',
  isActive: true
}

const toSlug = (str) =>
  str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

const CategoryFormDialog = ({ open, category, onSave, onClose, saving }) => {
  const [form, setForm] = useState(defaultForm)
  const [bannerFile, setBannerFile] = useState(null)
  const [iconFile, setIconFile] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      if (category) {
        setForm({
          name: category.name || '',
          slug: category.slug || '',
          shortDescription: category.shortDescription || '',
          displayOrder: category.displayOrder ?? '',
          isActive: category.isActive ?? true
        })
      } else {
        setForm(defaultForm)
      }
      setBannerFile(null)
      setIconFile(null)
      setErrors({})
    }
  }, [open, category])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'name' && !category) {
        next.slug = toSlug(value)
      }
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.slug.trim()) errs.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errs.slug = 'Slug must be lowercase letters, numbers, and hyphens only'
    }
    return errs
  }

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('slug', form.slug.trim())
    if (form.shortDescription) fd.append('shortDescription', form.shortDescription.trim())
    if (form.displayOrder !== '') fd.append('displayOrder', form.displayOrder)
    fd.append('isActive', form.isActive)
    if (bannerFile) fd.append('bannerImage', bannerFile)
    if (iconFile) fd.append('icon', iconFile)

    onSave(fd)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Category Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
          />
          <TextField
            label="Slug"
            name="slug"
            value={form.slug}
            onChange={handleChange}
            error={!!errors.slug}
            helperText={errors.slug || 'Lowercase letters, numbers, hyphens only'}
            required
            fullWidth
          />
          <TextField
            label="Short Description"
            name="shortDescription"
            value={form.shortDescription}
            onChange={handleChange}
            multiline
            rows={2}
            fullWidth
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            label="Display Order"
            name="displayOrder"
            value={form.displayOrder}
            onChange={handleChange}
            type="number"
            inputProps={{ min: 0 }}
            fullWidth
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Images
            </Typography>
            <Stack spacing={2}>
              <ImageUpload
                label="Banner Image"
                name="bannerImage"
                currentImageUrl={category?.bannerImage?.url || ''}
                onChange={setBannerFile}
              />
              <ImageUpload
                label="Icon"
                name="icon"
                currentImageUrl={category?.icon?.url || ''}
                onChange={setIconFile}
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving...' : category ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CategoryFormDialog
