import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, TextField, Stack, Typography, IconButton,
  Tooltip, Card, CardContent, CardActions, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import ConfirmDialog from '../../../components/ConfirmDialog'

const defaultForm = { question: '', answer: '', displayOrder: '' }

const FaqDialog = ({ open, faq, productId, onSaved, onClose, showToast }) => {
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(faq ? {
        question: faq.question || '',
        answer: faq.answer || '',
        displayOrder: faq.displayOrder ?? ''
      } : defaultForm)
      setErrors({})
    }
  }, [open, faq])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.question.trim()) errs.question = 'Question is required'
    if (!form.answer.trim()) errs.answer = 'Answer is required'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const data = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0
      }
      if (faq) {
        await productsService.updateFaq(faq._id, data)
        showToast('FAQ updated successfully')
      } else {
        await productsService.createFaq(productId, data)
        showToast('FAQ created successfully')
      }
      onSaved()
      onClose()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{faq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Question"
            name="question"
            value={form.question}
            onChange={handleChange}
            error={!!errors.question}
            helperText={errors.question}
            required
            fullWidth
          />
          <TextField
            label="Answer"
            name="answer"
            value={form.answer}
            onChange={handleChange}
            error={!!errors.answer}
            helperText={errors.answer}
            required
            multiline
            rows={4}
            fullWidth
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
          {saving ? 'Saving...' : faq ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const FaqsTab = ({ productId, showToast }) => {
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFaq, setSelectedFaq] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const fetchFaqs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsService.getFaqs(productId)
      setFaqs(res.data.faqs)
    } catch {
      showToast('Failed to load FAQs', 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, showToast])

  useEffect(() => { fetchFaqs() }, [fetchFaqs])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.deleteFaq(deleteDialog.id)
      showToast('FAQ deleted successfully')
      setDeleteDialog({ open: false, id: null })
      fetchFaqs()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">FAQs ({faqs.length})</Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setSelectedFaq(null); setDialogOpen(true) }}>
          Add FAQ
        </Button>
      </Box>

      {faqs.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>No FAQs added yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {faqs.map((faq) => (
            <Card key={faq._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{faq.question}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {faq.answer}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
                    Order: {faq.displayOrder}
                  </Typography>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => { setSelectedFaq(faq); setDialogOpen(true) }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: faq._id })}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      <FaqDialog
        open={dialogOpen}
        faq={selectedFaq}
        productId={productId}
        onSaved={fetchFaqs}
        onClose={() => setDialogOpen(false)}
        showToast={showToast}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null })}
        loading={deleting}
      />
    </Box>
  )
}

export default FaqsTab
