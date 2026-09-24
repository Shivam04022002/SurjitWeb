import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Alert, Link, useMediaQuery, useTheme
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Public, Unpublished, Visibility, Campaign, OpenInNew
} from '@mui/icons-material'
import { advertisementService } from '../../services/advertisement.service'
import { usePermissions } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUpload from '../../components/ImageUpload'
import Toast from '../../components/Toast'
import {
  MAX_IMAGE_BYTES, MAX_NAME, MAX_BUTTON_TEXT,
  validateAdvertisement, buildAdvertisementPayload, advertisementError, formatDateTime
} from './advertisementUtils'

const EMPTY = { name: '', applyUrl: '', applyButtonText: 'Apply', imageFile: null }

const AdvertisementsPage = () => {
  const perms = usePermissions()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [previewRow, setPreviewRow] = useState(null)
  const [statusDialog, setStatusDialog] = useState({ open: false, row: null })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, row: null })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchAdvertisements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await advertisementService.getAllAdvertisements({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
      setLoadError('')
    } catch (err) {
      setRows([])
      setTotal(0)
      setLoadError(advertisementError(err, 'Failed to load advertisements'))
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchAdvertisements, 300)
    return () => clearTimeout(t)
  }, [fetchAdvertisements])

  const published = useMemo(() => rows.find((r) => r.status === 'Published') || null, [rows])

  const openCreate = () => {
    setForm(EMPTY)
    setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      applyUrl: row.applyUrl || '',
      applyButtonText: row.applyButtonText || 'Apply',
      imageFile: null
    })
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const closeDialog = () => {
    if (saving) return
    setDialog({ open: false, editing: null })
  }

  const handleSave = async () => {
    const found = validateAdvertisement(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const payload = buildAdvertisementPayload(form)
      if (dialog.editing) {
        await advertisementService.updateAdvertisement(dialog.editing._id, payload)
        showToast('Advertisement updated')
      } else {
        await advertisementService.createAdvertisement(payload)
        showToast('Advertisement created as a draft')
      }
      setDialog({ open: false, editing: null })
      fetchAdvertisements()
    } catch (err) {
      showToast(advertisementError(err, 'Failed to save advertisement'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async () => {
    const row = statusDialog.row
    if (!row) return

    setBusy(true)
    try {
      if (row.status === 'Published') {
        await advertisementService.unpublishAdvertisement(row._id)
        showToast('Advertisement moved to draft')
      } else {
        await advertisementService.publishAdvertisement(row._id)
        showToast('Advertisement published — it is now the live one')
      }
      setStatusDialog({ open: false, row: null })
      fetchAdvertisements()
    } catch (err) {
      showToast(advertisementError(err, 'Failed to update status'), 'error')
      fetchAdvertisements()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const row = deleteDialog.row
    if (!row) return

    setBusy(true)
    try {
      await advertisementService.deleteAdvertisement(row._id)
      showToast('Advertisement deleted')
      setDeleteDialog({ open: false, row: null })
      fetchAdvertisements()
    } catch (err) {
      showToast(advertisementError(err, 'Failed to delete advertisement'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'imageUrl', headerName: 'Image', width: 110, sortable: false,
      renderCell: (p) => (p.row.imageUrl
        ? (
          <Box
            component="img" src={p.row.imageUrl} alt=""
            sx={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
          />
        )
        : (
          <Box sx={{
            width: 80, height: 48, borderRadius: 1, border: '1px dashed', borderColor: 'divider',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled'
          }}>
            <Campaign fontSize="small" />
          </Box>
        ))
    },
    {
      field: 'name', headerName: 'Name', flex: 1, minWidth: 180,
      renderCell: (p) => <Typography variant="body2" fontWeight={600}>{p.row.name}</Typography>
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
      field: 'applyUrl', headerName: 'Apply Link', flex: 1, minWidth: 200, sortable: false,
      renderCell: (p) => (
        <Stack spacing={0.25} sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" noWrap title={p.row.applyUrl}>{p.row.applyUrl || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">
            Button: {p.row.applyButtonText || 'Apply'}
          </Typography>
        </Stack>
      )
    },
    {
      field: 'updatedAt', headerName: 'Last Updated', width: 190,
      renderCell: (p) => (
        <Typography variant="caption" color="text.secondary">{formatDateTime(p.row.updatedAt)}</Typography>
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 180, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Preview">
            <IconButton size="small" onClick={() => setPreviewRow(p.row)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {perms.canPublish && (
            <Tooltip title={p.row.status === 'Published' ? 'Unpublish' : 'Publish'}>
              <span>
                <IconButton
                  size="small" disabled={busy}
                  color={p.row.status === 'Published' ? 'success' : 'default'}
                  onClick={() => setStatusDialog({ open: true, row: p.row })}
                >
                  {p.row.status === 'Published' ? <Public fontSize="small" /> : <Unpublished fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}

          {perms.canEdit && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton>
            </Tooltip>
          )}

          {/* Deleting is Super Admin only, and a published advertisement is
              refused by the server until it is moved to draft. */}
          {perms.isSuperAdmin && (
            <Tooltip title={p.row.status === 'Published' ? 'Move to draft before deleting' : 'Delete'}>
              <span>
                <IconButton
                  size="small" color="error"
                  disabled={busy || p.row.status === 'Published'}
                  onClick={() => setDeleteDialog({ open: true, row: p.row })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      )
    }
  ]

  // Narrow screens keep the columns that identify a row and act on it.
  const columnVisibilityModel = {
    imageUrl: !isMobile,
    applyUrl: !isCompact,
    updatedAt: !isCompact
  }

  const editing = dialog.editing
  const statusRow = statusDialog.row
  const willReplace = statusRow && statusRow.status !== 'Published' && published && published._id !== statusRow._id

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Advertisements</Typography>
          <Typography variant="body2" color="text.secondary">
            Only one advertisement can be published at a time — publishing one moves the others to draft
          </Typography>
        </Box>
        {perms.canCreate && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} fullWidth={isMobile}>
            Add Advertisement
          </Button>
        )}
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name or button text…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => { setStatus(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ width: { xs: '100%', sm: 170 } }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Published">Published</MenuItem>
          <MenuItem value="Draft">Draft</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        getRowId={(r) => r._id}
        loading={loading}
        rowHeight={72}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        autoHeight
        localeText={{ noRowsLabel: 'No advertisements yet' }}
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      {/* Add / edit */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? 'Edit Advertisement' : 'Add Advertisement'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Name" required fullWidth value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((x) => ({ ...x, name: '' })) }}
              error={!!errors.name}
              helperText={errors.name || 'Used only inside the CMS to tell advertisements apart'}
              inputProps={{ maxLength: MAX_NAME }}
            />

            <TextField
              label="Apply URL" required fullWidth value={form.applyUrl}
              onChange={(e) => { setForm((f) => ({ ...f, applyUrl: e.target.value })); setErrors((x) => ({ ...x, applyUrl: '' })) }}
              error={!!errors.applyUrl}
              helperText={errors.applyUrl || 'Where the button goes, e.g. /loan-application or https://…'}
            />

            <TextField
              label="Apply Button Text" fullWidth value={form.applyButtonText}
              onChange={(e) => { setForm((f) => ({ ...f, applyButtonText: e.target.value })); setErrors((x) => ({ ...x, applyButtonText: '' })) }}
              error={!!errors.applyButtonText}
              helperText={errors.applyButtonText || 'Left empty, the button reads "Apply"'}
              inputProps={{ maxLength: MAX_BUTTON_TEXT }}
            />

            <ImageUpload
              label="Advertisement Image"
              name="image"
              currentImageUrl={editing?.imageUrl || ''}
              maxSize={MAX_IMAGE_BYTES}
              hint="JPG, PNG, WEBP · Max 5 MB · the Canva artwork, as exported"
              allowRemove={false}
              error={errors.imageFile}
              onChange={(file) => { setForm((f) => ({ ...f, imageFile: file })); setErrors((x) => ({ ...x, imageFile: '' })) }}
            />

            {editing && editing.imageUrl && (
              <Typography variant="caption" color="text.secondary">
                The current artwork stays unless a new image is selected here.
              </Typography>
            )}

            {!editing && (
              <Alert severity="info">
                New advertisements are saved as drafts. Publish it from the list when it is ready.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview — how the artwork and the button read together. CMS only: the
          website does not display advertisements yet. */}
      <Dialog open={!!previewRow} onClose={() => setPreviewRow(null)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{previewRow?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
            {previewRow?.imageUrl
              ? (
                <Box
                  component="img" src={previewRow.imageUrl} alt={previewRow.name}
                  sx={{ width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                />
              )
              : <Alert severity="warning" sx={{ width: '100%' }}>No image has been uploaded yet.</Alert>}

            <Button variant="contained" fullWidth sx={{ pointerEvents: 'none' }} disableRipple>
              {previewRow?.applyButtonText || 'Apply'}
            </Button>

            {previewRow?.applyUrl && (
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', textAlign: 'center' }}>
                The button will open{' '}
                <Link href={previewRow.applyUrl} target="_blank" rel="noopener noreferrer">
                  {previewRow.applyUrl} <OpenInNew sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                </Link>
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              This preview is for the CMS only — the website does not display advertisements yet.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={statusDialog.open}
        title={statusRow?.status === 'Published' ? 'Move to draft' : 'Publish advertisement'}
        message={statusRow?.status === 'Published'
          ? `Move "${statusRow?.name}" to draft? No advertisement will be published afterwards.`
          : `Publish "${statusRow?.name}"?${willReplace ? ` This moves "${published?.name}" to draft, since only one advertisement can be published.` : ''}`}
        confirmLabel={statusRow?.status === 'Published' ? 'Move to draft' : 'Publish'}
        confirmColor={statusRow?.status === 'Published' ? 'warning' : 'primary'}
        loading={busy}
        onConfirm={handleStatusChange}
        onCancel={() => setStatusDialog({ open: false, row: null })}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete advertisement"
        message={`Delete "${deleteDialog.row?.name}"? Its image is removed as well, and this cannot be undone.`}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, row: null })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default AdvertisementsPage
