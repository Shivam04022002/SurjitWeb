import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, TextField, Stack, Typography, IconButton,
  Tooltip, Card, CardContent, CardActions, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Add, Edit, Delete, Save } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import ImageUpload from '../../../components/ImageUpload'
import ConfirmDialog from '../../../components/ConfirmDialog'

const defaultForm = { title: '', description: '', displayOrder: '' }

const FeatureDialog = ({ open, feature, productId, onSaved, onClose, showToast }) => {
  const [form, setForm] = useState(defaultForm)
  const [iconFile, setIconFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(feature ? {
        title: feature.title || '',
        description: feature.description || '',
        displayOrder: feature.displayOrder ?? ''
      } : defaultForm)
      setIconFile(null)
      setErrors({})
    }
  }, [open, feature])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title.trim())
      if (form.description) fd.append('description', form.description.trim())
      if (form.displayOrder !== '') fd.append('displayOrder', form.displayOrder)
      if (iconFile) fd.append('icon', iconFile)

      if (feature) {
        await productsService.updateFeature(feature._id, fd)
        showToast('Feature updated successfully')
      } else {
        await productsService.createFeature(productId, fd)
        showToast('Feature created successfully')
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
      <DialogTitle>{feature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
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
          <ImageUpload
            label="Icon"
            name="icon"
            currentImageUrl={feature?.icon?.url || ''}
            onChange={setIconFile}
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
          {saving ? 'Saving...' : feature ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const FeaturesTab = ({ productId, showToast }) => {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const fetchFeatures = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsService.getFeatures(productId)
      setFeatures(res.data.features)
    } catch {
      showToast('Failed to load features', 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, showToast])

  useEffect(() => { fetchFeatures() }, [fetchFeatures])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.deleteFeature(deleteDialog.id)
      showToast('Feature deleted successfully')
      setDeleteDialog({ open: false, id: null })
      fetchFeatures()
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
        <Typography variant="h6">Features ({features.length})</Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setSelectedFeature(null); setDialogOpen(true) }}>
          Add Feature
        </Button>
      </Box>

      {features.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>No features added yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {features.map((feat) => (
            <Card key={feat._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  {feat.icon?.url && (
                    <Box
                      component="img"
                      src={feat.icon.url}
                      alt={feat.title}
                      sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 1, flexShrink: 0 }}
                    />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{feat.title}</Typography>
                    {feat.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {feat.description}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">Order: {feat.displayOrder}</Typography>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => { setSelectedFeature(feat); setDialogOpen(true) }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: feat._id })}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      <FeatureDialog
        open={dialogOpen}
        feature={selectedFeature}
        productId={productId}
        onSaved={fetchFeatures}
        onClose={() => setDialogOpen(false)}
        showToast={showToast}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Feature"
        message="Are you sure you want to delete this feature?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null })}
        loading={deleting}
      />
    </Box>
  )
}

export default FeaturesTab
