import { useState, useEffect } from 'react'
import { Box, TextField, Button, Grid, Typography } from '@mui/material'
import { Save } from '@mui/icons-material'
import { careerService } from '../../../services/career.service'

const SeoTab = ({ job, onSaved, showToast }) => {
  const [form, setForm] = useState({ metaTitle: '', metaDescription: '', metaKeywords: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      metaTitle: job.seoMetaTitle || '',
      metaDescription: job.seoMetaDescription || '',
      metaKeywords: job.seoMetaKeywords || ''
    })
  }, [job])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await careerService.updateJob(job._id, {
        seoMetaTitle: form.metaTitle,
        seoMetaDescription: form.metaDescription,
        seoMetaKeywords: form.metaKeywords
      })
      showToast('SEO info saved successfully')
      onSaved()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600}>SEO Information</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth label="Meta Title" name="metaTitle"
            value={form.metaTitle} onChange={handleChange}
            inputProps={{ maxLength: 160 }}
            helperText={`${form.metaTitle.length}/160`}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth label="Meta Keywords" name="metaKeywords"
            value={form.metaKeywords} onChange={handleChange}
            placeholder="keyword1, keyword2, keyword3"
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth multiline rows={4} label="Meta Description" name="metaDescription"
            value={form.metaDescription} onChange={handleChange}
            inputProps={{ maxLength: 320 }}
            helperText={`${form.metaDescription.length}/320`}
          />
        </Grid>
      </Grid>
    </Box>
  )
}

export default SeoTab
