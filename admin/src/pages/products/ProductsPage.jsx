import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Avatar,
  IconButton, Tooltip, TextField, InputAdornment,
  Stack, MenuItem, Select, FormControl, InputLabel
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, CheckCircle, Cancel, OpenInNew
} from '@mui/icons-material'
import { productsService } from '../../services/products.service'
import ProductFormDialog from './ProductFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusChip from '../../components/StatusChip'
import Toast from '../../components/Toast'

const ProductsPage = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [productsRes, catsRes] = await Promise.all([
        productsService.getAllProducts(),
        productsService.getAllCategories()
      ])
      setProducts(productsRes.data.products)
      setCategories(catsRes.data.categories)
    } catch {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const q = search.toLowerCase()
    let result = products
    if (categoryFilter) result = result.filter((p) => (p.category?._id || p.category) === categoryFilter)
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    setFiltered(result)
  }, [search, categoryFilter, products])

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (selectedProduct) {
        await productsService.updateProduct(selectedProduct._id, formData)
        showToast('Product updated successfully')
      } else {
        await productsService.createProduct(formData)
        showToast('Product created successfully')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.deleteProduct(deleteDialog.id)
      showToast('Product deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchData()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await productsService.toggleProductStatus(id)
      fetchData()
      showToast('Status updated successfully')
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const columns = [
    {
      field: 'thumbnailImage',
      headerName: 'Image',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Avatar
          src={row.thumbnailImage?.url || row.heroImage?.url}
          alt={row.name}
          variant="rounded"
          sx={{ width: 44, height: 44 }}
        >
          {row.name?.[0]}
        </Avatar>
      )
    },
    { field: 'name', headerName: 'Product Name', flex: 1, minWidth: 160 },
    {
      field: 'category',
      headerName: 'Category',
      flex: 1,
      minWidth: 140,
      valueGetter: (params) => params.row?.category?.name || '—'
    },
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
      width: 160,
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
          <Tooltip title="Edit General Info">
            <IconButton size="small" color="primary" onClick={() => { setSelectedProduct(row); setFormOpen(true) }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open Editor">
            <IconButton size="small" color="secondary" onClick={() => navigate(`/products/${row._id}/edit`)}>
              <OpenInNew fontSize="small" />
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
        <Typography variant="h5" fontWeight={700}>Products</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => { setSelectedProduct(null); setFormOpen(true) }}
        >
          Add Product
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
          }}
          sx={{ width: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Filter by Category"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

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

      <ProductFormDialog
        open={formOpen}
        product={selectedProduct}
        categories={categories}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteDialog.name}"? This will remove all sections and data.`}
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

export default ProductsPage
