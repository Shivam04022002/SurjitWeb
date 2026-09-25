import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Button, IconButton, Tooltip, Stack, Chip,
  TextField, MenuItem, InputAdornment, Alert, useMediaQuery, useTheme
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Add, Edit, Search, Visibility, Lock } from '@mui/icons-material'
import { roleService } from '../../services/role.service'
import { usePermissions, usePermissionState } from '../../hooks/usePermissions'
import Toast from '../../components/Toast'
import RoleFormDialog from './RoleFormDialog'
import RoleDetailDialog from './RoleDetailDialog'
import { roleError, countGranted } from './permissionMatrix'

const RolesPage = () => {
  const perms = usePermissions()
  const { refresh: refreshMyPermissions } = usePermissionState()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))

  const [rows, setRows] = useState([])
  const [catalogue, setCatalogue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const [form, setForm] = useState({ open: false, role: null })
  const [detail, setDetail] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await roleService.getAllRoles({ search: search || undefined, status: status || undefined })
      setRows(res.data.data)
      setLoadError('')
    } catch (err) {
      setRows([])
      setLoadError(roleError(err, 'Failed to load roles'))
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const t = setTimeout(fetchRoles, 300)
    return () => clearTimeout(t)
  }, [fetchRoles])

  // The page list the matrix is built from. Fetched once: it changes only when
  // the application itself gains a page.
  useEffect(() => {
    roleService.getPermissionCatalogue()
      .then((res) => setCatalogue(res.data))
      .catch(() => setCatalogue(null))
  }, [])

  const afterSave = async (message) => {
    setForm({ open: false, role: null })
    showToast(message)
    fetchRoles()
    // The signed-in admin may have just changed their own role's reach.
    refreshMyPermissions()
  }

  const columns = [
    {
      field: 'name', headerName: 'Role', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Stack spacing={0.25} sx={{ overflow: 'hidden' }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" fontWeight={600}>{p.row.name}</Typography>
            {p.row.isSystem && (
              <Tooltip title="Built in — the application relies on this role">
                <Lock sx={{ fontSize: 14, color: 'text.disabled' }} />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.description || '—'}</Typography>
        </Stack>
      )
    },
    {
      field: 'access', headerName: 'Pages', width: 170, sortable: false,
      renderCell: (p) => {
        const { view, edit } = countGranted(p.row.levels)
        if (!view && !edit) return <Typography variant="caption" color="text.secondary">No pages</Typography>
        return (
          <Stack direction="row" spacing={0.5}>
            {edit > 0 && <Chip size="small" color="primary" label={`${edit} edit`} />}
            {view > 0 && <Chip size="small" variant="outlined" label={`${view} view`} />}
          </Stack>
        )
      }
    },
    {
      field: 'userCount', headerName: 'Users', width: 90,
      renderCell: (p) => <Typography variant="body2">{p.row.userCount}</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip
          label={p.row.status}
          size="small"
          color={p.row.status === 'Active' ? 'success' : 'default'}
          variant={p.row.status === 'Active' ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'updatedAt', headerName: 'Updated', width: 180,
      renderCell: (p) => (
        <Typography variant="caption" color="text.secondary">
          {p.row.updatedAt ? new Date(p.row.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
        </Typography>
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="View permissions">
            <IconButton size="small" onClick={() => setDetail(p.row)}><Visibility fontSize="small" /></IconButton>
          </Tooltip>
          {perms.canEdit && (
            <Tooltip title={p.row.key === 'super_admin' ? 'Super Admin always has every permission' : 'Edit'}>
              <span>
                <IconButton
                  size="small"
                  disabled={p.row.key === 'super_admin'}
                  onClick={() => setForm({ open: true, role: p.row })}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Roles &amp; Permissions</Typography>
          <Typography variant="body2" color="text.secondary">
            A role decides which pages its users can open, and which of those they can change
          </Typography>
        </Box>
        {perms.canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, role: null })}>
            Add Role
          </Button>
        )}
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {!perms.canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see how each role is set up. Changing a role needs edit access to this page.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search roles…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ width: { xs: '100%', sm: 170 } }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Inactive">Inactive</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        columnVisibilityModel={{ updatedAt: !isCompact, userCount: !isCompact }}
        getRowId={(r) => r._id}
        loading={loading}
        rowHeight={64}
        hideFooterSelectedRowCount
        disableRowSelectionOnClick
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        localeText={{ noRowsLabel: 'No roles yet' }}
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      {form.open && (
        <RoleFormDialog
          key={form.role?._id || 'new'}
          role={form.role}
          catalogue={catalogue}
          onClose={() => setForm({ open: false, role: null })}
          onSaved={afterSave}
          onError={(message) => showToast(message, 'error')}
        />
      )}

      <RoleDetailDialog
        role={detail}
        catalogue={catalogue}
        onClose={() => setDetail(null)}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default RolesPage
