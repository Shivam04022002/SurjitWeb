import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, CircularProgress, Alert, FormControlLabel, Switch
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Add, Edit, Delete, Search, Person } from '@mui/icons-material'
import { userService } from '../../services/user.service'
import { useAuth } from '../../hooks/useAuth'
import { ROLES, ROLE_LABELS } from '../../utils/constants'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const EMPTY = { name: '', email: '', password: '', role: ROLES.CONTENT_MANAGER, isActive: true }

const ROLE_COLOR = {
  [ROLES.SUPER_ADMIN]: 'error',
  [ROLES.EDITOR]: 'primary',
  [ROLES.CONTENT_MANAGER]: 'default'
}

const initialsOf = (name) => String(name || '?').trim().charAt(0).toUpperCase()

const fmt = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

// Manages the accounts that can sign in to the CMS. Super Admin only — the
// route is guarded server-side too, so a non-super-admin reaching this page
// simply gets 403s rather than data.
const UsersPage = () => {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await userService.getAllUsers({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        role: role || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch (err) {
      const status = err?.response?.status
      setLoadError(status === 403
        ? 'Only a Super Admin can manage CMS users.'
        : (err?.response?.data?.message || 'Failed to load users'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, role])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const openCreate = () => {
    setForm(EMPTY); setErrors({})
    setDialog({ open: true, editing: null })
  }

  const openEdit = (row) => {
    // Password is only sent when it is actually being reset.
    setForm({
      name: row.name || '', email: row.email || '', password: '',
      role: row.role || ROLES.CONTENT_MANAGER, isActive: row.isActive !== false
    })
    setErrors({})
    setDialog({ open: true, editing: row })
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (!dialog.editing && !form.password) e.password = 'Password is required'
    if (form.password && form.password.length < 8) e.password = 'Password must be at least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name, email: form.email, role: form.role, isActive: form.isActive
      }
      if (form.password) payload.password = form.password

      if (dialog.editing) {
        await userService.updateUser(dialog.editing._id, payload)
        showToast('User updated')
      } else {
        await userService.createUser(payload)
        showToast('User created')
      }
      setDialog({ open: false, editing: null })
      fetchUsers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save user', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await userService.deleteUser(deleteDialog.id)
      showToast('User deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchUsers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete user', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const isSelf = (row) => String(row._id) === String(currentUser?._id)

  const columns = [
    {
      field: 'name', headerName: 'Name', flex: 1.2, minWidth: 220,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
            {initialsOf(p.row.name)}
          </Avatar>
          <Stack spacing={0}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {p.row.name}{isSelf(p.row) ? ' (you)' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{p.row.email}</Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'role', headerName: 'Role', width: 170,
      renderCell: (p) => (
        <Chip
          label={ROLE_LABELS[p.row.role] || p.row.role}
          color={ROLE_COLOR[p.row.role] || 'default'}
          size="small"
          variant={p.row.role === ROLES.CONTENT_MANAGER ? 'outlined' : 'filled'}
        />
      )
    },
    {
      field: 'isActive', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip
          label={p.row.isActive ? 'Active' : 'Inactive'}
          color={p.row.isActive ? 'success' : 'default'}
          size="small"
          variant={p.row.isActive ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'lastLoginAt', headerName: 'Last Login', width: 130,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.lastLoginAt)}</Typography>
    },
    {
      field: 'createdAt', headerName: 'Created', width: 130,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.createdAt)}</Typography>
    },
    {
      field: 'actions', headerName: 'Actions', width: 130, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isSelf(p.row) ? 'You cannot delete your own account' : 'Delete'}>
            <span>
              <IconButton
                size="small" color="error" disabled={isSelf(p.row)}
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.name })}
              >
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Users</Typography>
          <Typography variant="body2" color="text.secondary">
            Accounts that can sign in to the CMS, and what each one may do
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={!isSuperAdmin}>
          Add User
        </Button>
      </Box>

      {!isSuperAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only a Super Admin can manage CMS users.
        </Alert>
      )}

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Role" value={role}
          onChange={(e) => { setRole(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All roles</MenuItem>
          {Object.values(ROLES).map((r) => (
            <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
          ))}
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
        <DialogTitle>{dialog.editing ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Name" required fullWidth value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((x) => ({ ...x, name: '' })) }}
              error={!!errors.name} helperText={errors.name}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Email" required fullWidth type="email" value={form.email}
              onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors((x) => ({ ...x, email: '' })) }}
              error={!!errors.email} helperText={errors.email}
            />
            <TextField
              label={dialog.editing ? 'New Password' : 'Password'}
              required={!dialog.editing} fullWidth type="password" value={form.password}
              onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors((x) => ({ ...x, password: '' })) }}
              error={!!errors.password}
              helperText={errors.password || (dialog.editing
                ? 'Leave empty to keep the current password'
                : 'At least 8 characters')}
            />
            <TextField
              select label="Role" fullWidth value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              helperText={
                form.role === ROLES.SUPER_ADMIN ? 'Full access, including users and deletions'
                  : form.role === ROLES.EDITOR ? 'Can create and edit content, but not delete'
                    : 'Read-only access to content'
              }
              disabled={dialog.editing && String(dialog.editing._id) === String(currentUser?._id)}
            >
              {Object.values(ROLES).map((r) => (
                <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
              ))}
            </TextField>
            {dialog.editing && String(dialog.editing._id) === String(currentUser?._id) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
                You cannot change your own role or deactivate yourself.
              </Typography>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  disabled={dialog.editing && String(dialog.editing._id) === String(currentUser?._id)}
                />
              }
              label="Active — can sign in"
            />
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
        title="Delete user"
        message={`Delete "${deleteDialog.name}"? They will lose access to the CMS immediately.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default UsersPage
