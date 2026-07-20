import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Rating, CircularProgress, InputAdornment
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { reviewService } from '../../services/review.service'
import ImageUpload from '../../components/ImageUpload'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const EMPTY = {
  customerName: '', rating: 5, review: '', productName: '', location: '', displayOrder: ''
}

const initialsOf = (name) => String(name || '?').trim().charAt(0).toUpperCase()

const ReviewsPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [published, setPublished] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reviewService.getAllReviews({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        isPublished: published === '' ? undefined : published
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load reviews', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, published])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchReviews, 300)
    return () => clearTimeout(t)
  }, [fetchReviews])

  const openCreate = () => {
    setForm(EMPTY); setPhotoFile(null); setPhotoUrl(''); setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      customerName: row.customerName || '',
      rating: row.rating || 5,
      review: row.review || '',
      productName: row.productName || '',
      location: row.location || '',
      displayOrder: row.displayOrder ?? ''
    })
    setPhotoFile(null)
    setPhotoUrl(row.customerImage?.url || '')
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const validate = () => {
    const e = {}
    if (!form.customerName.trim()) e.customerName = 'Customer name is required'
    if (!form.review.trim()) e.review = 'Review text is required'
    if (!form.rating || form.rating < 1 || form.rating > 5) e.rating = 'Rating must be 1–5'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('customerName', form.customerName)
      fd.append('rating', String(form.rating))
      fd.append('review', form.review)
      fd.append('productName', form.productName)
      fd.append('location', form.location)
      if (form.displayOrder !== '') fd.append('displayOrder', String(form.displayOrder))
      if (photoFile) fd.append('customerImage', photoFile)

      if (dialog.editing) {
        await reviewService.updateReview(dialog.editing._id, fd)
        showToast('Review updated')
      } else {
        await reviewService.createReview(fd)
        showToast('Review created')
      }
      setDialog({ open: false, editing: null })
      fetchReviews()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save review', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (row) => {
    try {
      await reviewService.toggleReviewStatus(row._id)
      showToast(row.isPublished ? 'Review unpublished' : 'Review published')
      fetchReviews()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await reviewService.deleteReview(deleteDialog.id)
      showToast('Review deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchReviews()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete review', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Swaps with the neighbour and sends the whole page order back. The list is
  // already sorted by displayOrder, so index order is website order.
  const handleMove = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return

    const next = [...rows]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setRows(next)

    setReordering(true)
    try {
      await reviewService.reorderReviews(next.map((r) => r._id))
      showToast('Order updated')
      fetchReviews()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchReviews()
    } finally {
      setReordering(false)
    }
  }

  const columns = [
    {
      field: 'customerImage', headerName: 'Photo', width: 80, sortable: false,
      renderCell: (p) => (
        <Avatar src={p.row.customerImage?.url || undefined} sx={{ bgcolor: 'primary.main' }}>
          {initialsOf(p.row.customerName)}
        </Avatar>
      )
    },
    { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 150 },
    {
      field: 'rating', headerName: 'Rating', width: 150, sortable: false,
      renderCell: (p) => <Rating value={p.row.rating} readOnly size="small" />
    },
    {
      field: 'review', headerName: 'Review', flex: 1.6, minWidth: 220,
      renderCell: (p) => (
        <Typography variant="body2" noWrap title={p.row.review}>{p.row.review}</Typography>
      )
    },
    {
      field: 'productName', headerName: 'Product', width: 150,
      renderCell: (p) => (p.row.productName
        ? <Chip label={p.row.productName} size="small" variant="outlined" />
        : <Typography variant="caption" color="text.disabled">—</Typography>)
    },
    { field: 'location', headerName: 'Location', width: 130 },
    { field: 'displayOrder', headerName: 'Order', width: 80 },
    {
      field: 'isPublished', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip
          label={p.row.isPublished ? 'Published' : 'Unpublished'}
          color={p.row.isPublished ? 'success' : 'default'}
          size="small"
          variant={p.row.isPublished ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        return (
          <Stack direction="row">
            <Tooltip title="Move up">
              <span>
                <IconButton size="small" disabled={index === 0 || reordering} onClick={() => handleMove(index, -1)}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton size="small" disabled={index === rows.length - 1 || reordering} onClick={() => handleMove(index, 1)}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={p.row.isPublished ? 'Unpublish' : 'Publish'}>
              <IconButton size="small" color={p.row.isPublished ? 'success' : 'default'} onClick={() => handleToggle(p.row)}>
                {p.row.isPublished ? <Public fontSize="small" /> : <Unpublished fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error"
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.customerName })}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      }
    }
  ]

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Customer Reviews</Typography>
          <Typography variant="body2" color="text.secondary">
            Shown in the sidebar of every blog article, in this order
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Review</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name, review, product or location…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={published}
          onChange={(e) => { setPublished(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Published</MenuItem>
          <MenuItem value="false">Unpublished</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        autoHeight
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      {/* Add / edit */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.editing ? 'Edit Review' : 'Add Review'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <ImageUpload
              label="Customer Photo (optional)"
              name="customerImage"
              currentImageUrl={photoUrl}
              onChange={(file) => setPhotoFile(file)}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              Left empty, the website shows an initials circle instead.
            </Typography>

            <TextField
              label="Customer Name" required fullWidth value={form.customerName}
              onChange={(e) => { setForm((f) => ({ ...f, customerName: e.target.value })); setErrors((x) => ({ ...x, customerName: '' })) }}
              error={!!errors.customerName} helperText={errors.customerName}
              inputProps={{ maxLength: 120 }}
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Rating *</Typography>
              <Rating
                value={Number(form.rating)}
                onChange={(_, v) => { setForm((f) => ({ ...f, rating: v || 1 })); setErrors((x) => ({ ...x, rating: '' })) }}
              />
              {errors.rating && <Typography variant="caption" color="error" display="block">{errors.rating}</Typography>}
            </Box>

            <TextField
              label="Review" required fullWidth multiline rows={4} value={form.review}
              onChange={(e) => { setForm((f) => ({ ...f, review: e.target.value })); setErrors((x) => ({ ...x, review: '' })) }}
              error={!!errors.review}
              helperText={errors.review || `${form.review.length}/1000`}
              inputProps={{ maxLength: 1000 }}
            />

            <TextField
              label="Loan / Product" fullWidth value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              helperText="e.g. Business Loan"
              inputProps={{ maxLength: 150 }}
            />
            <TextField
              label="Location" fullWidth value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              helperText="e.g. Lucknow"
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Display Order" fullWidth type="number" value={form.displayOrder}
              onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
              helperText="Left empty, it is added at the end"
              inputProps={{ min: 0 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {dialog.editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete review"
        message={`Delete the review from "${deleteDialog.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default ReviewsPage
