import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Divider
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, Place,
  OpenInNew, ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { branchService } from '../../services/branch.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const EMPTY = {
  branchName: '', address: '', city: '', state: '', pincode: '',
  phone: '', email: '', googleMapUrl: '', status: 'Draft', displayOrder: ''
}

// The single line the website renders, so the CMS shows exactly what a visitor
// will read.
const fullAddress = (b) =>
  [b.address, b.city, `${b.state || ''} ${b.pincode || ''}`.trim()]
    .filter(Boolean)
    .join(', ')

const BranchesPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await branchService.getAllBranches({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load branches', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchBranches, 300)
    return () => clearTimeout(t)
  }, [fetchBranches])

  const openCreate = () => {
    setForm(EMPTY)
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      branchName: row.branchName || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      pincode: row.pincode || '',
      phone: row.phone || '',
      email: row.email || '',
      googleMapUrl: row.googleMapUrl || '',
      status: row.status || 'Draft',
      displayOrder: row.displayOrder ?? ''
    })
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  // Mirrors the server rules so the editor is corrected before a round trip.
  const validate = () => {
    const e = {}
    if (!form.branchName.trim()) e.branchName = 'Branch name is required'
    if (!form.address.trim()) e.address = 'Address is required'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.state.trim()) e.state = 'State is required'
    if (!form.pincode.trim()) e.pincode = 'Pincode is required'
    else if (!/^\d{6}$/.test(form.pincode.trim())) e.pincode = 'Pincode must be 6 digits'
    if (form.phone && !/^[\d+\-()\s]{6,20}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (form.googleMapUrl && !/^https?:\/\//i.test(form.googleMapUrl.trim())) {
      e.googleMapUrl = 'Enter a valid URL starting with http:// or https://'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        branchName: form.branchName.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        googleMapUrl: form.googleMapUrl.trim(),
        status: form.status
      }
      if (form.displayOrder !== '') payload.displayOrder = Number(form.displayOrder)

      if (dialog.editing) {
        await branchService.updateBranch(dialog.editing._id, payload)
        showToast('Branch updated')
      } else {
        await branchService.createBranch(payload)
        showToast('Branch created')
      }
      setDialog({ open: false, editing: null })
      fetchBranches()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save branch', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (row) => {
    setBusy(true)
    try {
      if (row.status === 'Published') {
        await branchService.unpublishBranch(row._id)
        showToast('Branch moved to draft — hidden from the website')
      } else {
        await branchService.publishBranch(row._id)
        showToast('Branch published — now live on the website')
      }
      fetchBranches()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await branchService.deleteBranch(deleteDialog.id)
      showToast('Branch deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchBranches()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete branch', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleMove = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return

    const next = [...rows]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setRows(next)

    setBusy(true)
    try {
      await branchService.reorderBranches(next.map((b) => b._id))
      showToast('Order updated')
      fetchBranches()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchBranches()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'branchName', headerName: 'Branch', flex: 1.4, minWidth: 280,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <Place color="primary" />
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={p.row.branchName}>
              {p.row.branchName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={fullAddress(p.row)}>
              {fullAddress(p.row)}
            </Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'city', headerName: 'City', width: 130,
      renderCell: (p) => <Typography variant="body2">{p.row.city}</Typography>
    },
    {
      field: 'state', headerName: 'State', width: 150,
      renderCell: (p) => <Typography variant="body2">{p.row.state}</Typography>
    },
    { field: 'pincode', headerName: 'Pincode', width: 110 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip
          label={p.row.status}
          color={p.row.status === 'Published' ? 'success' : 'default'}
          size="small"
          variant={p.row.status === 'Published' ? 'filled' : 'outlined'}
        />
      )
    },
    { field: 'displayOrder', headerName: 'Order', width: 80 },
    {
      field: 'actions', headerName: 'Actions', width: 250, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        return (
          <Stack direction="row">
            <Tooltip title="Open in Google Maps">
              <span>
                <IconButton
                  size="small" disabled={!p.row.googleMapUrl}
                  onClick={() => window.open(p.row.googleMapUrl, '_blank', 'noopener')}
                >
                  <OpenInNew fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={p.row.status === 'Published' ? 'Unpublish' : 'Publish'}>
              <span>
                <IconButton
                  size="small" disabled={busy}
                  color={p.row.status === 'Published' ? 'success' : 'default'}
                  onClick={() => handlePublishToggle(p.row)}
                >
                  {p.row.status === 'Published' ? <Public fontSize="small" /> : <Unpublished fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move earlier">
              <span>
                <IconButton size="small" disabled={index === 0 || busy} onClick={() => handleMove(index, -1)}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move later">
              <span>
                <IconButton size="small" disabled={index === rows.length - 1 || busy} onClick={() => handleMove(index, 1)}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small" color="error"
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.branchName })}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      }
    }
  ]

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      const { value } = e.target
      setForm((f) => ({ ...f, [key]: value }))
      setErrors((x) => ({ ...x, [key]: '' }))
    },
    error: !!errors[key],
    helperText: errors[key]
  })

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Branches</Typography>
          <Typography variant="body2" color="text.secondary">
            Published branches appear on the website under Contact → Our Branches
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Branch</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name, address, city, state or pincode…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 340 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => { setStatus(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Published">Published</MenuItem>
          <MenuItem value="Draft">Draft</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        rowHeight={60}
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
        <DialogTitle>{dialog.editing ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Branch Name" required fullWidth {...field('branchName')} inputProps={{ maxLength: 150 }} />

            <TextField
              label="Address" required fullWidth multiline rows={2}
              {...field('address')}
              helperText={errors.address || 'Street line only — city, state and pincode go below'}
              inputProps={{ maxLength: 300 }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="City" required fullWidth {...field('city')} inputProps={{ maxLength: 100 }} />
              <TextField label="State" required fullWidth {...field('state')} inputProps={{ maxLength: 100 }} />
              <TextField
                label="Pincode" required fullWidth {...field('pincode')}
                inputProps={{ maxLength: 6, inputMode: 'numeric' }}
              />
            </Stack>

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Phone" fullWidth {...field('phone')} inputProps={{ maxLength: 20 }} />
              <TextField label="Email" fullWidth {...field('email')} inputProps={{ maxLength: 150 }} />
            </Stack>

            <TextField
              label="Google Map URL" fullWidth {...field('googleMapUrl')}
              helperText={errors.googleMapUrl || 'Optional — stored for future use'}
              inputProps={{ maxLength: 500 }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select label="Status" fullWidth value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Published">Published</MenuItem>
              </TextField>
              <TextField
                label="Display Order" fullWidth type="number" value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                helperText="Left empty, it is added at the end"
                inputProps={{ min: 0 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog({ open: false, editing: null })} disabled={saving}>Cancel</Button>
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
        title="Delete branch"
        message={`Delete "${deleteDialog.name}"? This removes it from the website and cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default BranchesPage
