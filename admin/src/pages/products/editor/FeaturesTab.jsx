import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, TextField, Stack, Typography, IconButton,
  Tooltip, Card, CardContent, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Add, Edit, Delete, ArrowUpward, ArrowDownward } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import ImageUpload from '../../../components/ImageUpload'
import ConfirmDialog from '../../../components/ConfirmDialog'

const defaultForm = { title: '', description: '' }

// Position is not a field here: it is set with the arrows on the list, through
// the reorder route. Sending displayOrder on an edit would also be refused for
// a Content Manager, which is what made features uneditable for that role.
const FeatureDialog = ({ open, feature, productId, onSaved, onClose, showToast }) => {
  const [form, setForm] = useState(defaultForm)
  const [iconFile, setIconFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(feature ? {
        title: feature.title || '',
        description: feature.description || ''
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
      // Always sent, so clearing the description on an edit actually clears it.
      fd.append('description', form.description.trim())
      if (iconFile) fd.append('icon', iconFile)

      if (feature) {
        await productsService.updateFeature(feature._id, fd)
        showToast('Feature updated successfully')
      } else {
        await productsService.createFeature(productId, fd)
        showToast('Feature added successfully')
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
            helperText={errors.title || 'Shown as the heading of the card on the website'}
            inputProps={{ maxLength: 200 }}
            required
            fullWidth
          />
          <TextField
            label="Short description (optional)"
            name="description"
            value={form.description}
            onChange={handleChange}
            helperText="Shown under the title. Leave empty for a title-only card."
            inputProps={{ maxLength: 1000 }}
            multiline
            rows={3}
            fullWidth
          />
          <ImageUpload
            label="Icon (optional)"
            name="icon"
            currentImageUrl={feature?.icon?.url || ''}
            onChange={setIconFile}
            hint="Replaces the default check mark on the card"
            allowRemove={false}
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
          {saving ? 'Saving...' : feature ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const FeaturesTab = ({ productId, showToast }) => {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const fetchFeatures = useCallback(async () => {
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

  // Reorder by moving one card past its neighbour and sending the whole order
  // back. The API returns the list sorted by displayOrder, so the index order
  // here is the order the website renders.
  const handleMove = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= features.length) return

    const next = [...features]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)

    setFeatures(next)
    setReordering(true)
    try {
      const res = await productsService.reorderFeatures(productId, next.map((f) => f._id))
      setFeatures(res.data.features)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to reorder', 'error')
      fetchFeatures()
    } finally {
      setReordering(false)
    }
  }

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
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          <Typography variant="h6">Features &amp; Benefits ({features.length})</Typography>
          <Typography variant="body2" color="text.secondary">
            The cards in this product&apos;s Features &amp; Benefits section, in the order shown. Use the arrows to reorder.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => { setSelectedFeature(null); setDialogOpen(true) }}
          sx={{ flexShrink: 0 }}
        >
          Add Feature
        </Button>
      </Box>

      {features.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>No features added yet.</Typography>
          <Typography variant="body2">The Features &amp; Benefits section is hidden on the website until one is added.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {features.map((feat, index) => (
            <Card key={feat._id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                {/* On a phone the controls wrap under the text rather than
                    pushing past the edge of the screen. */}
                <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 24, textAlign: 'right', flexShrink: 0 }}>
                    {index + 1}.
                  </Typography>
                  {feat.icon?.url && (
                    <Box
                      component="img"
                      src={feat.icon.url}
                      alt=""
                      sx={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 1, flexShrink: 0 }}
                    />
                  )}
                  <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{feat.title}</Typography>
                    {feat.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                        {feat.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 'auto' }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton size="small" aria-label={`Move ${feat.title} up`} onClick={() => handleMove(index, -1)} disabled={index === 0 || reordering}>
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton size="small" aria-label={`Move ${feat.title} down`} onClick={() => handleMove(index, 1)} disabled={index === features.length - 1 || reordering}>
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" aria-label={`Edit ${feat.title}`} onClick={() => { setSelectedFeature(feat); setDialogOpen(true) }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" aria-label={`Delete ${feat.title}`} onClick={() => setDeleteDialog({ open: true, id: feat._id })}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
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
        message="Are you sure you want to delete this feature? It will be removed from the website."
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
