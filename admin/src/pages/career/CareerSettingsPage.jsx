import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Paper, TextField, Button,
  Grid, Divider, CircularProgress, Avatar
} from '@mui/material'
import { Save, CloudUpload } from '@mui/icons-material'
import { careerService } from '../../services/career.service'
import Toast from '../../components/Toast'

const ImageUploadField = ({ label, preview, name, onChange }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" mb={1}>{label}</Typography>
    {preview && (
      <Avatar
        src={preview}
        variant="rounded"
        sx={{ width: '100%', height: 140, mb: 1, objectFit: 'cover' }}
      />
    )}
    <Button variant="outlined" component="label" startIcon={<CloudUpload />} size="small" fullWidth>
      {preview ? 'Change Image' : 'Upload Image'}
      <input type="file" hidden name={name} accept="image/*" onChange={onChange} />
    </Button>
  </Box>
)

const CareerSettingsPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [form, setForm] = useState({
    heroTitle: '',
    heroSubtitle: '',
    joinOurTeamTitle: '',
    joinOurTeamDescription: '',
    whyJoinTitle: '',
    whyJoinDescription: '',
    seo: { metaTitle: '', metaDescription: '', metaKeywords: '', canonicalUrl: '' }
  })
  const [previews, setPreviews] = useState({ heroBannerImage: '', whyJoinImage: '', ogImage: '' })
  const [files, setFiles] = useState({ heroBannerImage: null, whyJoinImage: null, ogImage: null })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchSettings = useCallback(async () => {
    try {
      const res = await careerService.getSettings()
      const s = res.data.settings
      setForm({
        heroTitle: s.heroTitle || '',
        heroSubtitle: s.heroSubtitle || '',
        joinOurTeamTitle: s.joinOurTeamTitle || '',
        joinOurTeamDescription: s.joinOurTeamDescription || '',
        whyJoinTitle: s.whyJoinTitle || '',
        whyJoinDescription: s.whyJoinDescription || '',
        seo: {
          metaTitle: s.seo?.metaTitle || '',
          metaDescription: s.seo?.metaDescription || '',
          metaKeywords: s.seo?.metaKeywords || '',
          canonicalUrl: s.seo?.canonicalUrl || ''
        }
      })
      setPreviews({
        heroBannerImage: s.heroBannerImage?.url || '',
        whyJoinImage: s.whyJoinImage?.url || '',
        ogImage: s.seo?.ogImage?.url || ''
      })
    } catch {
      showToast('Failed to load career settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.startsWith('seo.')) {
      const key = name.replace('seo.', '')
      setForm((prev) => ({ ...prev, seo: { ...prev.seo, [key]: value } }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleFileChange = (field) => (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFiles((prev) => ({ ...prev, [field]: file }))
    setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('heroTitle', form.heroTitle)
      fd.append('heroSubtitle', form.heroSubtitle)
      fd.append('joinOurTeamTitle', form.joinOurTeamTitle)
      fd.append('joinOurTeamDescription', form.joinOurTeamDescription)
      fd.append('whyJoinTitle', form.whyJoinTitle)
      fd.append('whyJoinDescription', form.whyJoinDescription)
      fd.append('seo', JSON.stringify(form.seo))
      if (files.heroBannerImage) fd.append('heroBannerImage', files.heroBannerImage)
      if (files.whyJoinImage) fd.append('whyJoinImage', files.whyJoinImage)
      if (files.ogImage) fd.append('seo.ogImage', files.ogImage)

      await careerService.updateSettings(fd)
      showToast('Career settings saved successfully')
      setFiles({ heroBannerImage: null, whyJoinImage: null, ogImage: null })
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" disableGutters>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700}>Career Settings</Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      <form onSubmit={handleSubmit}>
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>Hero Section</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <TextField fullWidth label="Hero Title" name="heroTitle" value={form.heroTitle} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField fullWidth multiline rows={3} label="Hero Subtitle" name="heroSubtitle" value={form.heroSubtitle} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ImageUploadField
                label="Hero Banner Image"
                preview={previews.heroBannerImage}
                name="heroBannerImage"
                onChange={handleFileChange('heroBannerImage')}
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>Join Our Team Section</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Join Our Team Title" name="joinOurTeamTitle" value={form.joinOurTeamTitle} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={4} label="Join Our Team Description" name="joinOurTeamDescription" value={form.joinOurTeamDescription} onChange={handleChange} />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>Why Join Us Section</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <TextField fullWidth label="Why Join Title" name="whyJoinTitle" value={form.whyJoinTitle} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField fullWidth multiline rows={4} label="Why Join Description" name="whyJoinDescription" value={form.whyJoinDescription} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ImageUploadField
                label="Why Join Image"
                preview={previews.whyJoinImage}
                name="whyJoinImage"
                onChange={handleFileChange('whyJoinImage')}
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>SEO</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Meta Title" name="seo.metaTitle" value={form.seo.metaTitle} onChange={handleChange} inputProps={{ maxLength: 160 }} helperText={`${form.seo.metaTitle.length}/160`} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Meta Keywords" name="seo.metaKeywords" value={form.seo.metaKeywords} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Meta Description" name="seo.metaDescription" value={form.seo.metaDescription} onChange={handleChange} inputProps={{ maxLength: 320 }} helperText={`${form.seo.metaDescription.length}/320`} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Canonical URL" name="seo.canonicalUrl" value={form.seo.canonicalUrl} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={3}>
              <ImageUploadField
                label="OG Image"
                preview={previews.ogImage}
                name="ogImage"
                onChange={handleFileChange('ogImage')}
              />
            </Grid>
          </Grid>
        </Paper>
      </form>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default CareerSettingsPage
