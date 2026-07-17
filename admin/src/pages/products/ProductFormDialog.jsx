import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Box, Typography, CircularProgress,
  MenuItem, Select, InputLabel, FormControl, FormHelperText
} from '@mui/material'
import ImageUpload from '../../components/ImageUpload'

const defaultForm = {
  category: '',
  name: '',
  slug: '',
  heroTitle: '',
  heroDescription: '',
  shortDescription: '',
  longDescription: '',
  displayOrder: '',
  isActive: true
}

const toSlug = (str) =>
  str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

const ProductFormDialog = ({ open, product, categories, onSave, onClose, saving }) => {
  const [form, setForm] = useState(defaultForm)
  const [heroFile, setHeroFile] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [thumbFile, setThumbFile] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          category: product.category?._id || product.category || '',
          name: product.name || '',
          slug: product.slug || '',
          heroTitle: product.heroTitle || '',
          heroDescription: product.heroDescription || '',
          shortDescription: product.shortDescription || '',
          longDescription: product.longDescription || '',
          displayOrder: product.displayOrder ?? '',
          isActive: product.isActive ?? true
        })
      } else {
        setForm(defaultForm)
      }
      setHeroFile(null)
      setBannerFile(null)
      setThumbFile(null)
      setErrors({})
    }
  }, [open, product])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'name' && !product) {
        next.slug = toSlug(value)
      }
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.category) errs.category = 'Category is required'
    if (!form.name.trim()) errs.name = 'Product name is required'
    if (!form.slug.trim()) errs.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errs.slug = 'Slug must be lowercase letters, numbers, and hyphens only'
    }
    return errs
  }

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const fd = new FormData()
    fd.append('category', form.category)
    fd.append('name', form.name.trim())
    fd.append('slug', form.slug.trim())
    if (form.heroTitle) fd.append('heroTitle', form.heroTitle.trim())
    if (form.heroDescription) fd.append('heroDescription', form.heroDescription.trim())
    if (form.shortDescription) fd.append('shortDescription', form.shortDescription.trim())
    if (form.longDescription) fd.append('longDescription', form.longDescription.trim())
    if (form.displayOrder !== '') fd.append('displayOrder', form.displayOrder)
    fd.append('isActive', form.isActive)
    if (heroFile) fd.append('heroImage', heroFile)
    if (bannerFile) fd.append('bannerImage', bannerFile)
    if (thumbFile) fd.append('thumbnailImage', thumbFile)

    onSave(fd)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <FormControl fullWidth required error={!!errors.category}>
            <InputLabel>Category</InputLabel>
            <Select name="category" value={form.category} label="Category" onChange={handleChange}>
              {categories.map((cat) => (
                <MenuItem key={cat._id} value={cat._id}>{cat.name}</MenuItem>
              ))}
            </Select>
            {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
          </FormControl>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Product Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              required
              fullWidth
            />
            <TextField
              label="Display Order"
              name="displayOrder"
              value={form.displayOrder}
              onChange={handleChange}
              type="number"
              inputProps={{ min: 0 }}
              sx={{ width: 160 }}
            />
          </Stack>

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
            label="Hero Title"
            name="heroTitle"
            value={form.heroTitle}
            onChange={handleChange}
            fullWidth
          />

          <TextField
            label="Hero Description"
            name="heroDescription"
            value={form.heroDescription}
            onChange={handleChange}
            multiline
            rows={2}
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
            label="Long Description"
            name="longDescription"
            value={form.longDescription}
            onChange={handleChange}
            multiline
            rows={4}
            fullWidth
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Images</Typography>
            <Stack spacing={2}>
              <ImageUpload
                label="Hero Image"
                name="heroImage"
                currentImageUrl={product?.heroImage?.url || ''}
                onChange={setHeroFile}
              />
              <ImageUpload
                label="Banner Image"
                name="bannerImage"
                currentImageUrl={product?.bannerImage?.url || ''}
                onChange={setBannerFile}
              />
              <ImageUpload
                label="Thumbnail Image"
                name="thumbnailImage"
                currentImageUrl={product?.thumbnailImage?.url || ''}
                onChange={setThumbFile}
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
          {saving ? 'Saving...' : product ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ProductFormDialog
