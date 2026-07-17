import { useState, useEffect } from 'react'
import {
  Box, Button, TextField, Stack, Typography, CircularProgress, LinearProgress
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import ImageUpload from '../../../components/ImageUpload'

const defaultForm = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  canonicalUrl: ''
}

const SeoTab = ({ productId, showToast }) => {
  const [form, setForm] = useState(defaultForm)
  const [ogImageFile, setOgImageFile] = useState(null)
  const [currentOgImage, setCurrentOgImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSeo = async () => {
      setLoading(true)
      try {
        const res = await productsService.getSeo(productId)
        const seo = res.data.seo || {}
        setForm({
          metaTitle: seo.metaTitle || '',
          metaDescription: seo.metaDescription || '',
          metaKeywords: seo.metaKeywords || '',
          canonicalUrl: seo.canonicalUrl || ''
        })
        setCurrentOgImage(seo.ogImage?.url || '')
      } catch {
        showToast('Failed to load SEO data', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchSeo()
  }, [productId, showToast])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      if (form.metaTitle) fd.append('metaTitle', form.metaTitle.trim())
      if (form.metaDescription) fd.append('metaDescription', form.metaDescription.trim())
      if (form.metaKeywords) fd.append('metaKeywords', form.metaKeywords.trim())
      if (form.canonicalUrl) fd.append('canonicalUrl', form.canonicalUrl.trim())
      if (ogImageFile) fd.append('ogImage', ogImageFile)

      await productsService.updateSeo(productId, fd)
      showToast('SEO data saved successfully')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const metaTitleLen = form.metaTitle.length
  const metaDescLen = form.metaDescription.length

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>SEO Configuration</Typography>

      <Stack spacing={2.5}>
        <Box>
          <TextField
            label="Meta Title"
            name="metaTitle"
            value={form.metaTitle}
            onChange={handleChange}
            fullWidth
            inputProps={{ maxLength: 160 }}
            helperText={`${metaTitleLen}/160 characters`}
          />
          <LinearProgress
            variant="determinate"
            value={(metaTitleLen / 160) * 100}
            color={metaTitleLen > 150 ? 'error' : metaTitleLen > 120 ? 'warning' : 'success'}
            sx={{ mt: 0.5, height: 3, borderRadius: 2 }}
          />
        </Box>

        <Box>
          <TextField
            label="Meta Description"
            name="metaDescription"
            value={form.metaDescription}
            onChange={handleChange}
            multiline
            rows={3}
            fullWidth
            inputProps={{ maxLength: 320 }}
            helperText={`${metaDescLen}/320 characters`}
          />
          <LinearProgress
            variant="determinate"
            value={(metaDescLen / 320) * 100}
            color={metaDescLen > 300 ? 'error' : metaDescLen > 250 ? 'warning' : 'success'}
            sx={{ mt: 0.5, height: 3, borderRadius: 2 }}
          />
        </Box>

        <TextField
          label="Meta Keywords"
          name="metaKeywords"
          value={form.metaKeywords}
          onChange={handleChange}
          fullWidth
          helperText="Comma-separated keywords"
        />

        <TextField
          label="Canonical URL"
          name="canonicalUrl"
          value={form.canonicalUrl}
          onChange={handleChange}
          fullWidth
          placeholder="https://example.com/product-slug"
        />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Open Graph Image</Typography>
          <ImageUpload
            label="OG Image (1200×630 recommended)"
            name="ogImage"
            currentImageUrl={currentOgImage}
            onChange={setOgImageFile}
          />
        </Box>
      </Stack>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save SEO Data'}
        </Button>
      </Box>
    </Box>
  )
}

export default SeoTab
