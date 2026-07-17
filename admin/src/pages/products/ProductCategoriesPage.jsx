import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, Avatar,
  IconButton, Tooltip, TextField, InputAdornment,
  Stack
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Add, Edit, Delete, Search, CheckCircle, Cancel } from '@mui/icons-material'
import { productsService } from '../../services/products.service'
import CategoryFormDialog from './CategoryFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusChip from '../../components/StatusChip'
import Toast from '../../components/Toast'

const ProductCategoriesPage = () => {
  const [categories, setCategories] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsService.getAllCategories()
      setCategories(res.data.categories)
    } catch {
      showToast('Failed to load categories', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)))
  }, [search, categories])

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (selectedCategory) {
        await productsService.updateCategory(selectedCategory._id, formData)
        showToast('Category updated successfully')
      } else {
        await productsService.createCategory(formData)
        showToast('Category created successfully')
      }
      setFormOpen(false)
      fetchCategories()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.deleteCategory(deleteDialog.id)
      showToast('Category deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchCategories()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await productsService.toggleCategoryStatus(id)
      fetchCategories()
      showToast('Status updated successfully')
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const columns = [
    {
      field: 'bannerImage',
      headerName: 'Image',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Avatar
          src={row.bannerImage?.url}
          alt={row.name}
          variant="rounded"
          sx={{ width: 44, height: 44 }}
        >
          {row.name?.[0]}
        </Avatar>
      )
    },
    {
      field: 'icon',
      headerName: 'Icon',
      width: 70,
      sortable: false,
      renderCell: ({ row }) =>
        row.icon?.url ? (
          <Avatar src={row.icon.url} alt="icon" variant="rounded" sx={{ width: 36, height: 36 }}>
            {row.name?.[0]}
          </Avatar>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        )
    },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 150 },
    { field: 'displayOrder', headerName: 'Order', width: 80, type: 'number' },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => <StatusChip isActive={row.isActive} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <IconButton
              size="small"
              color={row.isActive ? 'success' : 'default'}
              onClick={() => handleToggleStatus(row._id)}
            >
              {row.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => { setSelectedCategory(row); setFormOpen(true) }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => setDeleteDialog({ open: true, id: row._id, name: row.name })}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700}>Product Categories</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelectedCategory(null); setFormOpen(true) }}>
          Add Category
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
          }}
          sx={{ width: 320 }}
        />
      </Box>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(row) => row._id}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.100' } }}
        />
      </Box>

      <CategoryFormDialog
        open={formOpen}
        category={selectedCategory}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteDialog.name}"? All products in this category may be affected.`}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
        loading={deleting}
      />

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default ProductCategoriesPage
