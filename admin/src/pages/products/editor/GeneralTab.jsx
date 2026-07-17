import { useState, useEffect } from 'react'
import {
  Box, TextField, Stack, Button, CircularProgress,
  Typography, MenuItem, Select, InputLabel, FormControl
} from '@mui/material'
import { Save } from '@mui/icons-material'
import ImageUpload from '../../../components/ImageUpload'
import { productsService } from '../../../services/products.service'

const toSlug = (str) =>
  str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

const GeneralTab = ({ product, categories, onSaved, showToast }) => {
  const [form, setForm] = useState({})
  const [heroFile, setHeroFile] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [thumbFile, setThumbFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
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
    }
  }, [product])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'name') next.slug = toSlug(value)
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.category) errs.category = 'Category is required'
    if (!form.name?.trim()) errs.name = 'Product name is required'
    if (!form.slug?.trim()) errs.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errs.slug = 'Slug must be lowercase letters, numbers, and hyphens only'
    }
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
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

      await productsService.updateProduct(product._id, fd)
      showToast('General info saved successfully')
      onSaved()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Stack spacing={2.5}>
        <FormControl fullWidth required error={!!errors.category}>
          <InputLabel>Category</InputLabel>
          <Select name="category" value={form.category || ''} label="Category" onChange={handleChange}>
            {categories.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Product Name"
            name="name"
            value={form.name || ''}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
          />
          <TextField
            label="Display Order"
            name="displayOrder"
            value={form.displayOrder ?? ''}
            onChange={handleChange}
            type="number"
            inputProps={{ min: 0 }}
            sx={{ width: 160 }}
          />
        </Stack>

        <TextField
          label="Slug"
          name="slug"
          value={form.slug || ''}
          onChange={handleChange}
          error={!!errors.slug}
          helperText={errors.slug || 'Auto-generated from name. Lowercase letters, numbers, hyphens only.'}
          required
          fullWidth
        />

        <TextField
          label="Hero Title"
          name="heroTitle"
          value={form.heroTitle || ''}
          onChange={handleChange}
          fullWidth
        />

        <TextField
          label="Hero Description"
          name="heroDescription"
          value={form.heroDescription || ''}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
        />

        <TextField
          label="Short Description"
          name="shortDescription"
          value={form.shortDescription || ''}
          onChange={handleChange}
          multiline
          rows={2}
          fullWidth
          inputProps={{ maxLength: 500 }}
        />

        <TextField
          label="Long Description"
          name="longDescription"
          value={form.longDescription || ''}
          onChange={handleChange}
          multiline
          rows={5}
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

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save General Info'}
        </Button>
      </Box>
    </Box>
  )
}

export default GeneralTab
