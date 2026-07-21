import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Paper, Divider
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, PictureAsPdf,
  OpenInNew, UploadFile, ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { reportService } from '../../services/report.service'
import ImageUpload from '../../components/ImageUpload'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const MAX_PDF = 25 * 1024 * 1024

const EMPTY = {
  title: '', year: new Date().getFullYear(), financialYear: '',
  description: '', status: 'Draft', displayOrder: ''
}

const fmt = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

const sizeOf = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

const ReportsPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfName, setPdfName] = useState('')
  const [thumbFile, setThumbFile] = useState(null)
  const [thumbUrl, setThumbUrl] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const pdfRef = useRef(null)

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: '' })
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportService.getAllReports({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load reports', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchReports, 300)
    return () => clearTimeout(t)
  }, [fetchReports])

  const openCreate = () => {
    setForm(EMPTY); setPdfFile(null); setPdfName(''); setThumbFile(null); setThumbUrl('')
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      title: row.title || '',
      year: row.year || new Date().getFullYear(),
      financialYear: row.financialYear || '',
      description: row.description || '',
      status: row.status || 'Draft',
      displayOrder: row.displayOrder ?? ''
    })
    setPdfFile(null)
    setPdfName(row.pdf?.originalName || '')
    setThumbFile(null)
    setThumbUrl(row.thumbnail?.url || '')
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const handlePdf = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Mirrors the server rules so the editor is corrected before an upload of
    // up to 25 MB is sent and rejected.
    const isPdf = file.type === 'application/pdf' && /\.pdf$/i.test(file.name)
    if (!isPdf) {
      setErrors((x) => ({ ...x, pdf: 'Only PDF files are accepted' }))
      return
    }
    if (file.size > MAX_PDF) {
      setErrors((x) => ({ ...x, pdf: 'PDF must be under 25 MB' }))
      return
    }
    setPdfFile(file)
    setPdfName(file.name)
    setErrors((x) => ({ ...x, pdf: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.year) e.year = 'Year is required'
    else if (Number(form.year) < 1900 || Number(form.year) > 2200) e.year = 'Enter a valid year'
    if (form.financialYear && !/^\d{4}(-\d{2,4})?$/.test(form.financialYear.trim())) {
      e.financialYear = 'Use a format like 2024-25'
    }
    if (!dialog.editing && !pdfFile) e.pdf = 'A PDF file is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('year', String(form.year))
      fd.append('financialYear', form.financialYear)
      fd.append('description', form.description)
      fd.append('status', form.status)
      if (form.displayOrder !== '') fd.append('displayOrder', String(form.displayOrder))
      if (pdfFile) fd.append('pdf', pdfFile)
      if (thumbFile) fd.append('thumbnail', thumbFile)

      if (dialog.editing) {
        await reportService.updateReport(dialog.editing._id, fd)
        showToast('Report updated')
      } else {
        await reportService.createReport(fd)
        showToast('Report uploaded')
      }
      setDialog({ open: false, editing: null })
      fetchReports()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save report', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (row) => {
    setBusy(true)
    try {
      if (row.status === 'Published') {
        await reportService.unpublishReport(row._id)
        showToast('Report moved to draft — hidden from the website')
      } else {
        await reportService.publishReport(row._id)
        showToast('Report published — now live on the website')
      }
      fetchReports()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await reportService.deleteReport(deleteDialog.id)
      showToast('Report deleted')
      setDeleteDialog({ open: false, id: null, title: '' })
      fetchReports()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete report', 'error')
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
      await reportService.reorderReports(next.map((r) => r._id))
      showToast('Order updated')
      fetchReports()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchReports()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'title', headerName: 'Title', flex: 1.3, minWidth: 240,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <PictureAsPdf color="error" />
          <Stack spacing={0}>
            <Typography variant="body2" fontWeight={600} noWrap title={p.row.title}>{p.row.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {p.row.pdf?.originalName || 'report.pdf'}{p.row.pdf?.size ? ` · ${sizeOf(p.row.pdf.size)}` : ''}
            </Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'financialYear', headerName: 'Financial Year', width: 150,
      renderCell: (p) => (p.row.financialYear
        ? <Chip label={p.row.financialYear} size="small" variant="outlined" />
        : <Typography variant="body2">{p.row.year}</Typography>)
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip
          label={p.row.status}
          color={p.row.status === 'Published' ? 'success' : 'default'}
          size="small"
          variant={p.row.status === 'Published' ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'createdAt', headerName: 'Uploaded', width: 130,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.createdAt)}</Typography>
    },
    { field: 'displayOrder', headerName: 'Order', width: 80 },
    {
      field: 'actions', headerName: 'Actions', width: 250, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        return (
          <Stack direction="row">
            <Tooltip title="Preview PDF">
              <span>
                <IconButton
                  size="small" disabled={!p.row.pdf?.url}
                  onClick={() => window.open(p.row.pdf.url, '_blank', 'noopener')}
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
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, title: p.row.title })}
              >
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
          <Typography variant="h5" fontWeight={700}>Annual Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Published reports appear on the website under Reports → Annual Returns
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Upload Report</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search title, financial year or description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 320 }}
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

      {/* Upload / edit */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.editing ? 'Edit Report' : 'Upload Annual Report'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3, borderRadius: 2, borderStyle: 'dashed', textAlign: 'center',
                cursor: 'pointer', bgcolor: 'grey.50', '&:hover': { bgcolor: 'grey.100' },
                borderColor: errors.pdf ? 'error.main' : undefined
              }}
              onClick={() => pdfRef.current?.click()}
            >
              <input ref={pdfRef} type="file" hidden accept="application/pdf,.pdf" onChange={handlePdf} />
              <UploadFile sx={{ fontSize: 36, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                {pdfName || 'Click to choose a PDF'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF only · Max 25 MB{dialog.editing ? ' · Leave empty to keep the current file' : ''}
              </Typography>
            </Paper>
            {errors.pdf && <Typography variant="caption" color="error">{errors.pdf}</Typography>}

            <TextField
              label="Title" required fullWidth value={form.title}
              onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setErrors((x) => ({ ...x, title: '' })) }}
              error={!!errors.title} helperText={errors.title}
              inputProps={{ maxLength: 200 }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Year" required fullWidth type="number" value={form.year}
                onChange={(e) => { setForm((f) => ({ ...f, year: e.target.value })); setErrors((x) => ({ ...x, year: '' })) }}
                error={!!errors.year} helperText={errors.year}
              />
              <TextField
                label="Financial Year" fullWidth value={form.financialYear}
                onChange={(e) => { setForm((f) => ({ ...f, financialYear: e.target.value })); setErrors((x) => ({ ...x, financialYear: '' })) }}
                error={!!errors.financialYear}
                helperText={errors.financialYear || 'e.g. 2024-25'}
                inputProps={{ maxLength: 20 }}
              />
            </Stack>

            <TextField
              label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              inputProps={{ maxLength: 1000 }}
            />

            <Divider />

            <ImageUpload
              label="Thumbnail (optional)"
              name="thumbnail"
              currentImageUrl={thumbUrl}
              onChange={(file) => setThumbFile(file)}
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
            {dialog.editing ? 'Save' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete report"
        message={`Delete "${deleteDialog.title}"? The PDF is removed from storage and this cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, title: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default ReportsPage
