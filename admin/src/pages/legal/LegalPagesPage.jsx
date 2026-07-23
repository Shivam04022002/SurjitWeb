import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Paper, Divider, FormHelperText
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, Gavel,
  OpenInNew, UploadFile, ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { legalPageService } from '../../services/legalPage.service'
import RichTextEditor from '../../components/RichTextEditor'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const MAX_PDF = 25 * 1024 * 1024

const TYPES = [
  { value: 'nodal', label: 'Nodal Officer' },
  { value: 'privacy', label: 'Privacy Policy' },
  { value: 'refund', label: 'Refund Policy' },
  { value: 'terms', label: 'Terms & Conditions' }
]
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))

const EMPTY = {
  title: '', slug: '', type: 'privacy', description: '', content: '',
  seoTitle: '', seoDescription: '', status: 'Draft', displayOrder: ''
}

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const fmt = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

const sizeOf = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

const LegalPagesPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfName, setPdfName] = useState('')
  const [existingPdf, setExistingPdf] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const pdfRef = useRef(null)

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: '' })
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await legalPageService.getAllPages({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load legal pages', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchPages, 300)
    return () => clearTimeout(t)
  }, [fetchPages])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: '' }))
  }

  const openCreate = () => {
    setForm(EMPTY); setSlugTouched(false)
    setPdfFile(null); setPdfName(''); setExistingPdf(null)
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      title: row.title || '',
      slug: row.slug || '',
      type: row.type || 'privacy',
      description: row.description || '',
      content: row.content || '',
      seoTitle: row.seoTitle || '',
      seoDescription: row.seoDescription || '',
      status: row.status || 'Draft',
      displayOrder: row.displayOrder ?? ''
    })
    setSlugTouched(true)
    setPdfFile(null); setPdfName('')
    setExistingPdf(row.pdf && (row.pdf.url || row.pdf.fileName) ? row.pdf : null)
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const handleTitle = (value) => {
    setField('title', value)
    if (!slugTouched) setField('slug', slugify(value))
  }

  const handlePdf = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' && /\.pdf$/i.test(file.name)
    if (!isPdf) { setErrors((x) => ({ ...x, pdf: 'Only PDF files are accepted' })); return }
    if (file.size > MAX_PDF) { setErrors((x) => ({ ...x, pdf: 'PDF must be under 25 MB' })); return }
    setPdfFile(file); setPdfName(file.name)
    setErrors((x) => ({ ...x, pdf: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.slug.trim()) e.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Lowercase letters, numbers and hyphens only'
    if (!form.type) e.type = 'Type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('slug', form.slug)
      fd.append('type', form.type)
      fd.append('description', form.description)
      fd.append('content', form.content)
      fd.append('seoTitle', form.seoTitle)
      fd.append('seoDescription', form.seoDescription)
      fd.append('status', form.status)
      if (form.displayOrder !== '') fd.append('displayOrder', String(form.displayOrder))
      if (pdfFile) fd.append('pdf', pdfFile)

      if (dialog.editing) {
        await legalPageService.updatePage(dialog.editing._id, fd)
        showToast('Legal page updated')
      } else {
        await legalPageService.createPage(fd)
        showToast('Legal page created')
      }
      setDialog({ open: false, editing: null })
      fetchPages()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save legal page', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (row) => {
    setBusy(true)
    try {
      if (row.status === 'Published') {
        await legalPageService.unpublishPage(row._id)
        showToast('Page moved to draft — hidden from the website')
      } else {
        await legalPageService.publishPage(row._id)
        showToast('Page published — now live on the website')
      }
      fetchPages()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await legalPageService.deletePage(deleteDialog.id)
      showToast('Legal page deleted')
      setDeleteDialog({ open: false, id: null, title: '' })
      fetchPages()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete legal page', 'error')
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
      await legalPageService.reorderPages(next.map((p) => p._id))
      showToast('Order updated')
      fetchPages()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchPages()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'title', headerName: 'Page', flex: 1.3, minWidth: 240,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <Gavel color="primary" />
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={p.row.title}>{p.row.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>/{p.row.slug}</Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'type', headerName: 'Type', width: 150,
      renderCell: (p) => <Chip label={TYPE_LABEL[p.row.type] || p.row.type} size="small" variant="outlined" />
    },
    {
      field: 'pdf', headerName: 'PDF', width: 90,
      renderCell: (p) => (p.row.pdf && (p.row.pdf.url || p.row.pdf.fileName)
        ? <Chip label="PDF" size="small" color="info" variant="outlined" />
        : <Typography variant="caption" color="text.disabled">—</Typography>)
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
    {
      field: 'updatedAt', headerName: 'Updated', width: 130,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.updatedAt)}</Typography>
    },
    { field: 'displayOrder', headerName: 'Order', width: 80 },
    {
      field: 'actions', headerName: 'Actions', width: 250, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        const pdfUrl = p.row.pdf?.url
        return (
          <Stack direction="row">
            <Tooltip title="Open PDF">
              <span>
                <IconButton size="small" disabled={!pdfUrl} onClick={() => window.open(pdfUrl, '_blank', 'noopener')}>
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
          <Typography variant="h5" fontWeight={700}>Legal Pages</Typography>
          <Typography variant="body2" color="text.secondary">
            Nodal Officer, Privacy Policy, Refund Policy and Terms &amp; Conditions — linked from the website footer
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Page</Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search title, slug or type…"
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

      {/* Add / edit */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="md" fullWidth>
        <DialogTitle>{dialog.editing ? 'Edit Legal Page' : 'Add Legal Page'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Title" required fullWidth value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                error={!!errors.title} helperText={errors.title}
                inputProps={{ maxLength: 200 }}
              />
              <TextField
                select label="Type" required fullWidth value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                error={!!errors.type} helperText={errors.type || 'Classifies the page'}
                sx={{ maxWidth: { sm: 220 } }}
              >
                {TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Stack>

            <TextField
              label="Slug" required fullWidth value={form.slug}
              onChange={(e) => { setSlugTouched(true); setField('slug', e.target.value) }}
              error={!!errors.slug}
              helperText={errors.slug || 'The URL path, e.g. privacy-policy — changing it changes the page URL'}
              inputProps={{ maxLength: 200 }}
            />

            <TextField
              label="Description" fullWidth value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              helperText="Optional lead line shown under the page heading"
              inputProps={{ maxLength: 500 }}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Content</Typography>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setField('content', html)}
                showToast={showToast}
              />
            </Box>

            <Divider />

            {/* PDF */}
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
              <UploadFile sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                {pdfName || (existingPdf ? (existingPdf.originalName || 'Current PDF attached') : 'Click to attach a PDF (optional)')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF only · Max 25 MB{dialog.editing ? ' · Leave empty to keep the current file' : ''}
              </Typography>
            </Paper>
            {errors.pdf && <Typography variant="caption" color="error">{errors.pdf}</Typography>}
            {existingPdf && !pdfName && (
              <FormHelperText>
                Current: <a href={existingPdf.url} target="_blank" rel="noopener noreferrer">{existingPdf.originalName || existingPdf.url}</a>
                {existingPdf.size ? ` · ${sizeOf(existingPdf.size)}` : ''}
              </FormHelperText>
            )}

            <Divider />

            <Typography variant="subtitle2">SEO</Typography>
            <TextField
              label="SEO Title" fullWidth value={form.seoTitle}
              onChange={(e) => setField('seoTitle', e.target.value)}
              helperText="Left empty, the page title is used"
              inputProps={{ maxLength: 200 }}
            />
            <TextField
              label="SEO Description" fullWidth multiline rows={2} value={form.seoDescription}
              onChange={(e) => setField('seoDescription', e.target.value)}
              inputProps={{ maxLength: 500 }}
            />

            <Divider />

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
        title="Delete legal page"
        message={`Delete "${deleteDialog.title}"? This removes it from the website and cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, title: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default LegalPagesPage
