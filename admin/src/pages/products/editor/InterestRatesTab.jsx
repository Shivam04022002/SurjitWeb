import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, TextField, Stack, Typography, IconButton,
  Tooltip, Card, CardContent, CardActions, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import ConfirmDialog from '../../../components/ConfirmDialog'

const defaultForm = {
  loanAmountFrom: '',
  loanAmountTo: '',
  interestRate: '',
  tenure: '',
  displayOrder: ''
}

const RateDialog = ({ open, rate, productId, onSaved, onClose, showToast }) => {
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(rate ? {
        loanAmountFrom: rate.loanAmountFrom ?? '',
        loanAmountTo: rate.loanAmountTo ?? '',
        interestRate: rate.interestRate ?? '',
        tenure: rate.tenure || '',
        displayOrder: rate.displayOrder ?? ''
      } : defaultForm)
      setErrors({})
    }
  }, [open, rate])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (form.loanAmountFrom === '') errs.loanAmountFrom = 'Required'
    if (form.loanAmountTo === '') errs.loanAmountTo = 'Required'
    if (form.interestRate === '') errs.interestRate = 'Required'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const data = {
        loanAmountFrom: Number(form.loanAmountFrom),
        loanAmountTo: Number(form.loanAmountTo),
        interestRate: Number(form.interestRate),
        tenure: form.tenure,
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0
      }
      if (rate) {
        await productsService.updateInterestRate(rate._id, data)
        showToast('Interest rate updated successfully')
      } else {
        await productsService.createInterestRate(productId, data)
        showToast('Interest rate created successfully')
      }
      onSaved()
      onClose()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n) => n !== undefined && n !== '' ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{rate ? 'Edit Interest Rate' : 'Add Interest Rate'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Loan Amount From (₹)"
              name="loanAmountFrom"
              value={form.loanAmountFrom}
              onChange={handleChange}
              type="number"
              inputProps={{ min: 0 }}
              error={!!errors.loanAmountFrom}
              helperText={errors.loanAmountFrom}
              required
              fullWidth
            />
            <TextField
              label="Loan Amount To (₹)"
              name="loanAmountTo"
              value={form.loanAmountTo}
              onChange={handleChange}
              type="number"
              inputProps={{ min: 0 }}
              error={!!errors.loanAmountTo}
              helperText={errors.loanAmountTo}
              required
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Interest Rate (%)"
              name="interestRate"
              value={form.interestRate}
              onChange={handleChange}
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              error={!!errors.interestRate}
              helperText={errors.interestRate}
              required
              fullWidth
            />
            <TextField
              label="Tenure"
              name="tenure"
              value={form.tenure}
              onChange={handleChange}
              placeholder="e.g. 12-60 months"
              fullWidth
            />
          </Stack>
          <TextField
            label="Display Order"
            name="displayOrder"
            value={form.displayOrder}
            onChange={handleChange}
            type="number"
            inputProps={{ min: 0 }}
            fullWidth
          />
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
          {saving ? 'Saving...' : rate ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const InterestRatesTab = ({ productId, showToast }) => {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRate, setSelectedRate] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsService.getInterestRates(productId)
      setRates(res.data.interestRates)
    } catch {
      showToast('Failed to load interest rates', 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, showToast])

  useEffect(() => { fetchRates() }, [fetchRates])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.deleteInterestRate(deleteDialog.id)
      showToast('Interest rate deleted successfully')
      setDeleteDialog({ open: false, id: null })
      fetchRates()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const fmtAmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Interest Rates ({rates.length})</Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setSelectedRate(null); setDialogOpen(true) }}>
          Add Rate
        </Button>
      </Box>

      {rates.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>No interest rates added yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rates.map((rate) => (
            <Card key={rate._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography variant="subtitle2">
                      {fmtAmt(rate.loanAmountFrom)} – {fmtAmt(rate.loanAmountTo)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rate: <strong>{rate.interestRate}%</strong>
                      {rate.tenure && <> &nbsp;·&nbsp; Tenure: {rate.tenure}</>}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">Order: {rate.displayOrder}</Typography>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => { setSelectedRate(rate); setDialogOpen(true) }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: rate._id })}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      <RateDialog
        open={dialogOpen}
        rate={selectedRate}
        productId={productId}
        onSaved={fetchRates}
        onClose={() => setDialogOpen(false)}
        showToast={showToast}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Interest Rate"
        message="Are you sure you want to delete this interest rate?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null })}
        loading={deleting}
      />
    </Box>
  )
}

export default InterestRatesTab
