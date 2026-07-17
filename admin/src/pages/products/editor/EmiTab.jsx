import { useState, useEffect } from 'react'
import {
  Box, Button, TextField, Stack, Typography, CircularProgress,
  Grid, Divider
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'

const defaultConfig = {
  minimumAmount: '',
  maximumAmount: '',
  defaultAmount: '',
  interestRate: '',
  minimumTenure: '',
  maximumTenure: '',
  defaultTenure: ''
}

const EmiTab = ({ productId, showToast }) => {
  const [form, setForm] = useState(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchEmi = async () => {
      setLoading(true)
      try {
        const res = await productsService.getEmiConfig(productId)
        const config = res.data.emiConfig || {}
        setForm({
          minimumAmount: config.minimumAmount ?? '',
          maximumAmount: config.maximumAmount ?? '',
          defaultAmount: config.defaultAmount ?? '',
          interestRate: config.interestRate ?? '',
          minimumTenure: config.minimumTenure ?? '',
          maximumTenure: config.maximumTenure ?? '',
          defaultTenure: config.defaultTenure ?? ''
        })
      } catch {
        showToast('Failed to load EMI config', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchEmi()
  }, [productId, showToast])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {}
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '') data[k] = Number(v)
      })
      await productsService.updateEmiConfig(productId, data)
      showToast('EMI configuration saved successfully')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>EMI Calculator Configuration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the default values and limits for the EMI calculator displayed on the product page.
      </Typography>

      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
            Loan Amount (₹)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Minimum Amount"
                name="minimumAmount"
                value={form.minimumAmount}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 0 }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Maximum Amount"
                name="maximumAmount"
                value={form.maximumAmount}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 0 }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Default Amount"
                name="defaultAmount"
                value={form.defaultAmount}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 0 }}
                fullWidth
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
            Interest Rate (%)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Interest Rate (%)"
                name="interestRate"
                value={form.interestRate}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                fullWidth
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
            Tenure (Months)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Minimum Tenure"
                name="minimumTenure"
                value={form.minimumTenure}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Maximum Tenure"
                name="maximumTenure"
                value={form.maximumTenure}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Default Tenure"
                name="defaultTenure"
                value={form.defaultTenure}
                onChange={handleChange}
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
              />
            </Grid>
          </Grid>
        </Box>
      </Stack>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save EMI Config'}
        </Button>
      </Box>
    </Box>
  )
}

export default EmiTab
