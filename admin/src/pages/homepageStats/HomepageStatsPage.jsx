import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, Insights,
  ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { homepageStatService } from '../../services/homepageStat.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const EMPTY = { value: '', title: '', status: 'Draft', displayOrder: '' }

// Mirrors the split the homepage uses to drive its count-up animation, so the
// editor can see whether a value will animate before saving it.
const splitValue = (value) => {
  const m = String(value || '').match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/)
  if (!m) return null
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] }
}

const HomepageStatsPage = () => {
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

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await homepageStatService.getAllStats({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load statistics', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchStats, 300)
    return () => clearTimeout(t)
  }, [fetchStats])

  const openCreate = () => {
    setForm(EMPTY)
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      value: row.value || '',
      title: row.title || '',
      status: row.status || 'Draft',
      displayOrder: row.displayOrder ?? ''
    })
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const validate = () => {
    const e = {}
    if (!form.value.trim()) e.value = 'Value is required'
    else if (form.value.trim().length > 20) e.value = 'Value must not exceed 20 characters'
    if (!form.title.trim()) e.title = 'Title is required'
    else if (form.title.trim().length > 100) e.title = 'Title must not exceed 100 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        value: form.value.trim(),
        title: form.title.trim(),
        status: form.status
      }
      if (form.displayOrder !== '') payload.displayOrder = Number(form.displayOrder)

      if (dialog.editing) {
        await homepageStatService.updateStat(dialog.editing._id, payload)
        showToast('Statistic updated')
      } else {
        await homepageStatService.createStat(payload)
        showToast('Statistic created')
      }
      setDialog({ open: false, editing: null })
      fetchStats()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save statistic', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (row) => {
    setBusy(true)
    try {
      if (row.status === 'Published') {
        await homepageStatService.unpublishStat(row._id)
        showToast('Statistic moved to draft — hidden from the homepage')
      } else {
        await homepageStatService.publishStat(row._id)
        showToast('Statistic published — now live on the homepage')
      }
      fetchStats()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await homepageStatService.deleteStat(deleteDialog.id)
      showToast('Statistic deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchStats()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete statistic', 'error')
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
      await homepageStatService.reorderStats(next.map((s) => s._id))
      showToast('Order updated')
      fetchStats()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchStats()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'value', headerName: 'Value', width: 150,
      renderCell: (p) => (
        <Typography variant="h6" fontWeight={700} color="primary.main">{p.row.value}</Typography>
      )
    },
    {
      field: 'title', headerName: 'Title', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Insights color="primary" />
          <Typography variant="body2" fontWeight={600}>{p.row.title}</Typography>
        </Stack>
      )
    },
    {
      field: 'animation', headerName: 'Animation', width: 190, sortable: false,
      renderCell: (p) => {
        const parts = splitValue(p.row.value)
        return parts
          ? <Typography variant="caption" color="text.secondary">counts up to {parts.number}</Typography>
          : <Typography variant="caption" color="warning.main">shown as-is (no number)</Typography>
      }
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
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.title })}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      }
    }
  ]

  const parts = splitValue(form.value)

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Homepage Statistics</Typography>
          <Typography variant="body2" color="text.secondary">
            Published statistics appear in the counter strip at the top of the homepage
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Statistic</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search value or title…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 300 }}
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
        <DialogTitle>{dialog.editing ? 'Edit Statistic' : 'Add Statistic'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Value" required fullWidth value={form.value}
              onChange={(e) => { setForm((f) => ({ ...f, value: e.target.value })); setErrors((x) => ({ ...x, value: '' })) }}
              error={!!errors.value}
              helperText={errors.value
                || (form.value
                  ? (parts
                    ? `Homepage counts up to ${parts.number}, then shows "${form.value}"`
                    : 'No number found — the homepage will show this as-is, without counting up')
                  : 'Type it exactly as it should read, e.g. 35+, 10K+, ₹50Cr+')}
              inputProps={{ maxLength: 20 }}
            />

            <TextField
              label="Title" required fullWidth value={form.title}
              onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setErrors((x) => ({ ...x, title: '' })) }}
              error={!!errors.title}
              helperText={errors.title || 'The label under the number, e.g. Branches'}
              inputProps={{ maxLength: 100 }}
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
        title="Delete statistic"
        message={`Delete "${deleteDialog.name}"? This removes it from the homepage and cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default HomepageStatsPage
