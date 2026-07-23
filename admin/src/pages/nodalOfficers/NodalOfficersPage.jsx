import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Divider
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, SupportAgent,
  ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { nodalOfficerService } from '../../services/nodalOfficer.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const EMPTY = {
  companyName: '', officerName: '', designation: '', address: '',
  email: '', phone: '', status: 'Draft', displayOrder: ''
}

const NodalOfficersPage = () => {
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

  const fetchOfficers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await nodalOfficerService.getAllOfficers({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load nodal officers', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchOfficers, 300)
    return () => clearTimeout(t)
  }, [fetchOfficers])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: '' }))
  }

  const openCreate = () => {
    setForm(EMPTY)
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      companyName: row.companyName || '',
      officerName: row.officerName || '',
      designation: row.designation || '',
      address: row.address || '',
      email: row.email || '',
      phone: row.phone || '',
      status: row.status || 'Draft',
      displayOrder: row.displayOrder ?? ''
    })
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  // Mirrors the server rules so the editor is corrected before a round trip.
  const validate = () => {
    const e = {}
    if (!form.companyName.trim()) e.companyName = 'Company name is required'
    if (!form.officerName.trim()) e.officerName = 'Officer name is required'
    if (!form.designation.trim()) e.designation = 'Designation is required'
    if (!form.address.trim()) e.address = 'Address is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    else if (!/^[\d+\-()\s]{6,30}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        companyName: form.companyName.trim(),
        officerName: form.officerName.trim(),
        designation: form.designation.trim(),
        address: form.address,
        email: form.email.trim(),
        phone: form.phone.trim(),
        status: form.status
      }
      if (form.displayOrder !== '') payload.displayOrder = Number(form.displayOrder)

      if (dialog.editing) {
        await nodalOfficerService.updateOfficer(dialog.editing._id, payload)
        showToast('Nodal officer updated')
      } else {
        await nodalOfficerService.createOfficer(payload)
        showToast('Nodal officer created')
      }
      setDialog({ open: false, editing: null })
      fetchOfficers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save nodal officer', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (row) => {
    setBusy(true)
    try {
      if (row.status === 'Published') {
        await nodalOfficerService.unpublishOfficer(row._id)
        showToast('Officer moved to draft — hidden from the website')
      } else {
        await nodalOfficerService.publishOfficer(row._id)
        showToast('Officer published — now live on the website')
      }
      fetchOfficers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await nodalOfficerService.deleteOfficer(deleteDialog.id)
      showToast('Nodal officer deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchOfficers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete nodal officer', 'error')
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
      await nodalOfficerService.reorderOfficers(next.map((o) => o._id))
      showToast('Order updated')
      fetchOfficers()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchOfficers()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'officerName', headerName: 'Officer', flex: 1.2, minWidth: 240,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <SupportAgent color="primary" />
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={p.row.officerName}>
              {p.row.officerName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={p.row.designation}>
              {p.row.designation}
            </Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'companyName', headerName: 'Company', width: 170,
      renderCell: (p) => <Typography variant="body2">{p.row.companyName}</Typography>
    },
    {
      field: 'email', headerName: 'Contact', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap title={p.row.email}>{p.row.email}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.phone}</Typography>
        </Stack>
      )
    },
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
      field: 'actions', headerName: 'Actions', width: 210, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        return (
          <Stack direction="row">
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
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.officerName })}
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
    onChange: (e) => setField(key, e.target.value),
    error: !!errors[key],
    helperText: errors[key]
  })

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Nodal Officers</Typography>
          <Typography variant="body2" color="text.secondary">
            Published officers appear on the website Nodal Officer page
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Officer</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name, company, designation, email or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 360 }}
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
        <DialogTitle>{dialog.editing ? 'Edit Nodal Officer' : 'Add Nodal Officer'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Company Name" required fullWidth {...field('companyName')} inputProps={{ maxLength: 150 }}
              helperText={errors.companyName || 'Shown as "{Company}’s Nodal Officer Details"'} />
            <TextField label="Officer Name" required fullWidth {...field('officerName')} inputProps={{ maxLength: 120 }} />
            <TextField label="Designation" required fullWidth {...field('designation')} inputProps={{ maxLength: 200 }} />
            <TextField
              label="Address" required fullWidth multiline rows={3}
              {...field('address')}
              helperText={errors.address || 'Each line appears on its own row on the website'}
              inputProps={{ maxLength: 400 }}
            />

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Email" required fullWidth {...field('email')} inputProps={{ maxLength: 150 }} />
              <TextField label="Phone" required fullWidth {...field('phone')} inputProps={{ maxLength: 30 }} />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select label="Status" fullWidth value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Published">Published</MenuItem>
              </TextField>
              <TextField
                label="Display Order" fullWidth type="number" value={form.displayOrder}
                onChange={(e) => setField('displayOrder', e.target.value)}
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
        title="Delete nodal officer"
        message={`Delete "${deleteDialog.name}"? This removes them from the website and cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default NodalOfficersPage
