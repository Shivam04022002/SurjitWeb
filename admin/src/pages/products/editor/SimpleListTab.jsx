import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, TextField, Stack, Typography, IconButton,
  Tooltip, Card, CardContent, CardActions, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import ConfirmDialog from '../../../components/ConfirmDialog'

const defaultForm = { title: '', description: '', displayOrder: '' }

const ItemDialog = ({ open, item, label, onSave, onClose, saving }) => {
  const [form, setForm] = useState(defaultForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(item ? {
        title: item.title || '',
        description: item.description || '',
        displayOrder: item.displayOrder ?? ''
      } : defaultForm)
      setErrors({})
    }
  }, [open, item])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = () => {
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return }
    onSave(form)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? `Edit ${label}` : `Add ${label}`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Title"
            name="title"
            value={form.title}
            onChange={handleChange}
            error={!!errors.title}
            helperText={errors.title}
            required
            fullWidth
          />
          <TextField
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange}
            multiline
            rows={3}
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
          {saving ? 'Saving...' : item ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const SimpleListTab = ({
  productId,
  label,
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  showToast
}) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchItems(productId)
      const key = Object.keys(res.data).find((k) => Array.isArray(res.data[k]))
      setItems(key ? res.data[key] : [])
    } catch {
      showToast(`Failed to load ${label}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, fetchItems, label, showToast])

  useEffect(() => { loadItems() }, [loadItems])

  const handleSave = async (form) => {
    setSaving(true)
    try {
      const data = {
        title: form.title.trim(),
        description: form.description?.trim() || '',
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0
      }
      if (selectedItem) {
        await updateItem(selectedItem._id, data)
        showToast(`${label} updated successfully`)
      } else {
        await createItem(productId, data)
        showToast(`${label} created successfully`)
      }
      setDialogOpen(false)
      loadItems()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteItem(deleteDialog.id)
      showToast(`${label} deleted successfully`)
      setDeleteDialog({ open: false, id: null })
      loadItems()
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
        <Typography variant="h6">{label} ({items.length})</Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setSelectedItem(null); setDialogOpen(true) }}>
          Add {label}
        </Button>
      </Box>

      {items.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>No {label.toLowerCase()} added yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Card key={item._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{item.title}</Typography>
                    {item.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
                    Order: {item.displayOrder}
                  </Typography>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => { setSelectedItem(item); setDialogOpen(true) }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: item._id })}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      <ItemDialog
        open={dialogOpen}
        item={selectedItem}
        label={label}
        onSave={handleSave}
        onClose={() => setDialogOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title={`Delete ${label}`}
        message={`Are you sure you want to delete this ${label.toLowerCase()}?`}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null })}
        loading={deleting}
      />
    </Box>
  )
}

export default SimpleListTab
