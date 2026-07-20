import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Add, Edit, Delete, CheckCircle, Cancel } from '@mui/icons-material'
import { blogService } from '../../services/blog.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const EMPTY = { name: '', slug: '', description: '', displayOrder: '' }

const BlogCategoriesPage = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '', count: 0 })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await blogService.getAllCategories()
      setRows(res.data.categories)
    } catch {
      showToast('Failed to load categories', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const openCreate = () => {
    setForm(EMPTY); setErrors({}); setSlugTouched(false)
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      slug: row.slug || '',
      description: row.description || '',
      displayOrder: row.displayOrder ?? ''
    })
    setErrors({}); setSlugTouched(true)
    setDialog({ open: true, editing: row })
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.slug.trim()) e.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Lowercase letters, numbers and hyphens only'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description
      }
      if (form.displayOrder !== '') payload.displayOrder = Number(form.displayOrder)

      if (dialog.editing) {
        await blogService.updateCategory(dialog.editing._id, payload)
        showToast('Category updated')
      } else {
        await blogService.createCategory(payload)
        showToast('Category created')
      }
      setDialog({ open: false, editing: null })
      fetchCategories()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save category', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (row) => {
    try {
      await blogService.toggleCategoryStatus(row._id)
      fetchCategories()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await blogService.deleteCategory(deleteDialog.id)
      showToast('Category deleted')
      setDeleteDialog({ open: false, id: null, name: '', count: 0 })
      fetchCategories()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete category', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 160,
      renderCell: (p) => <Typography variant="body2" color="text.secondary">/{p.row.slug}</Typography> },
    { field: 'description', headerName: 'Description', flex: 1.4, minWidth: 200,
      renderCell: (p) => (
        <Typography variant="body2" noWrap title={p.row.description}>
          {p.row.description || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
        </Typography>
      ) },
    { field: 'blogsCount', headerName: 'Blogs', width: 90,
      renderCell: (p) => <Chip label={p.row.blogsCount ?? 0} size="small" variant="outlined" /> },
    { field: 'displayOrder', headerName: 'Order', width: 90 },
    { field: 'isActive', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip
          label={p.row.isActive ? 'Enabled' : 'Disabled'}
          color={p.row.isActive ? 'success' : 'default'}
          size="small"
          variant={p.row.isActive ? 'filled' : 'outlined'}
        />
      ) },
    {
      field: 'actions', headerName: 'Actions', width: 150, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title={p.row.isActive ? 'Disable' : 'Enable'}>
            <IconButton size="small" color={p.row.isActive ? 'success' : 'default'} onClick={() => handleToggle(p.row)}>
              {p.row.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small" color="error"
              onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.name, count: p.row.blogsCount ?? 0 })}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Blog Categories</Typography>
          <Typography variant="body2" color="text.secondary">
            Group articles and drive Related Blogs on the website
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Category</Button>
      </Box>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        autoHeight
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Name" required fullWidth value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))
                setErrors((x) => ({ ...x, name: '' }))
              }}
              error={!!errors.name} helperText={errors.name}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Slug" required fullWidth value={form.slug}
              onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); setErrors((x) => ({ ...x, slug: '' })) }}
              error={!!errors.slug} helperText={errors.slug}
              inputProps={{ maxLength: 150 }}
            />
            <TextField
              label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              inputProps={{ maxLength: 500 }}
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
        title="Delete category"
        message={
          deleteDialog.count
            ? `Delete "${deleteDialog.name}"? ${deleteDialog.count} blog(s) will become uncategorised — they stay published.`
            : `Delete "${deleteDialog.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '', count: 0 })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default BlogCategoriesPage
