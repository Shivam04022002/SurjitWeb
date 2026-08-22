import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, IconButton, Tooltip, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  InputAdornment, Button, Divider, Link
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Search, Visibility, OpenInNew } from '@mui/icons-material'
import { loanApplicationService } from '../../services/loanApplication.service'
import { usePermissions } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { productsService } from '../../services/products.service'
import Toast from '../../components/Toast'

const STATUS_COLOR = {
  pending: 'warning',
  'under-review': 'info',
  approved: 'success',
  rejected: 'default'
}

// The four values the model has always allowed.
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
]

const LOAN_TYPES = [
  { value: 'business', label: 'Business' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'lap', label: 'Micro LAP' }
]

const fmt = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

const money = (n) => (typeof n === 'number' ? '₹' + n.toLocaleString('en-IN') : '—')

// Applications submitted before products were associated carry no reference.
// They are shown as unassociated rather than guessed at.
const NOT_ASSOCIATED = 'Not associated'

// Documents live in S3 and are stored as absolute URLs on the application.
const DOCUMENTS = [
  { key: 'aadhaarCardUrl', label: 'Aadhaar Card' },
  { key: 'panCardUrl', label: 'PAN Card' },
  { key: 'bankStatementUrl', label: 'Bank Statement' },
  { key: 'businessProofUrl', label: 'Business Proof' }
]

const Row = ({ label, value }) => (
  <Typography variant="body2" sx={{ mb: 0.5 }}>
    <strong>{label}:</strong> {value === undefined || value === null || value === '' ? '—' : String(value)}
  </Typography>
)

const LoanApplicationsPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loanType, setLoanType] = useState('')
  const [product, setProduct] = useState('')
  const [products, setProducts] = useState([])
  const [viewing, setViewing] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const perms = usePermissions()
  const [statusDialog, setStatusDialog] = useState({ open: false, next: '', application: null })
  const [savingStatus, setSavingStatus] = useState(false)

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  // Product filter options come from the CMS catalogue, so a product added
  // later appears here with no code change.
  useEffect(() => {
    productsService.getAllProducts()
      .then((res) => setProducts(res?.data?.products || res?.products || []))
      .catch(() => setProducts([]))
  }, [])

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await loanApplicationService.getAllApplications({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined,
        loanType: loanType || undefined,
        product: product || undefined
      })
      const payload = res?.data || {}
      setRows(payload.applications || [])
      setTotal(payload.total || 0)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load applications', 'error')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status, loanType, product])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchApplications, 300)
    return () => clearTimeout(t)
  }, [fetchApplications])

  // The list deliberately omits PAN, Aadhaar, DOB and address; the detail
  // endpoint supplies them only when a row is opened.
  const openDetail = async (id) => {
    try {
      const res = await loanApplicationService.getApplicationById(id)
      setViewing(res?.data?.application || null)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load application', 'error')
    }
  }

  // Confirmed status change. The row is updated in place so pagination,
  // filters and the open dialog all stay exactly where they were.
  const applyStatusChange = async () => {
    const { application, next } = statusDialog
    if (!application || !next || savingStatus) return
    setSavingStatus(true)
    try {
      const res = await loanApplicationService.updateLoanApplicationStatus(application._id, next)
      const updated = res?.data?.application
      const newStatus = updated?.status || next
      setRows((prev) => {
        // If a status filter is active and the row no longer matches it, drop
        // the row rather than showing a contradiction.
        if (status && newStatus !== status) return prev.filter((r) => r._id !== application._id)
        return prev.map((r) => (r._id === application._id ? { ...r, status: newStatus } : r))
      })
      if (status && newStatus !== status) setTotal((t) => Math.max(t - 1, 0))
      setViewing((v) => (v && v._id === application._id ? { ...v, status: newStatus } : v))
      showToast(`Status updated to ${newStatus}`)
      setStatusDialog({ open: false, next: '', application: null })
    } catch (err) {
      // Previous status is left untouched on failure.
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setSavingStatus(false)
    }
  }

  const columns = [
    {
      field: 'applicationNumber', headerName: 'Application #', width: 150,
      renderCell: (p) => <Typography variant="body2" fontWeight={600}>{p.row.applicationNumber}</Typography>
    },
    {
      field: 'fullName', headerName: 'Applicant', flex: 1, minWidth: 180,
      renderCell: (p) => (
        <Stack spacing={0} sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" fontWeight={600} noWrap>{p.row.fullName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.phone}</Typography>
        </Stack>
      )
    },
    {
      field: 'product', headerName: 'Product', flex: 1, minWidth: 180, sortable: false,
      renderCell: (p) => (p.row.product?.name
        ? <Typography variant="body2" noWrap>{p.row.product.name}</Typography>
        : <Typography variant="caption" color="text.disabled">{NOT_ASSOCIATED}</Typography>)
    },
    {
      field: 'loanType', headerName: 'Loan Type', width: 130,
      renderCell: (p) => <Chip label={p.row.loanType || '—'} size="small" variant="outlined" />
    },
    {
      field: 'loanAmount', headerName: 'Amount', width: 130,
      renderCell: (p) => <Typography variant="body2">{money(p.row.loanAmount)}</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 140,
      renderCell: (p) => (
        <Chip label={p.row.status} color={STATUS_COLOR[p.row.status] || 'default'} size="small" />
      )
    },
    {
      field: 'createdAt', headerName: 'Applied On', width: 130,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.createdAt)}</Typography>
    },
    {
      field: 'actions', headerName: '', width: 70, sortable: false, filterable: false,
      renderCell: (p) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => openDetail(p.row._id)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ]

  const resetPage = () => setPaginationModel((p) => ({ ...p, page: 0 }))

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Loan Applications</Typography>
        <Typography variant="body2" color="text.secondary">
          Applications submitted from the public website
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          size="small" placeholder="Search application no., name, phone or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage() }}
          sx={{ minWidth: 320 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Product" value={product} sx={{ minWidth: 200 }}
          onChange={(e) => { setProduct(e.target.value); resetPage() }}
        >
          <MenuItem value="">All products</MenuItem>
          {products.map((p) => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
        </TextField>
        <TextField
          size="small" select label="Loan Type" value={loanType} sx={{ minWidth: 160 }}
          onChange={(e) => { setLoanType(e.target.value); resetPage() }}
        >
          <MenuItem value="">All types</MenuItem>
          {LOAN_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <TextField
          size="small" select label="Status" value={status} sx={{ minWidth: 160 }}
          onChange={(e) => { setStatus(e.target.value); resetPage() }}
        >
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="under-review">Under Review</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 20, 50, 100]}
        disableRowSelectionOnClick
        autoHeight
        sx={{ bgcolor: 'background.paper' }}
      />

      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        {viewing && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6">{viewing.fullName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewing.applicationNumber}
                  </Typography>
                </Box>
                <Chip label={viewing.status} color={STATUS_COLOR[viewing.status] || 'default'} size="small" />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Application</Typography>
              <Row label="Product" value={viewing.product?.name || NOT_ASSOCIATED} />
              <Row label="Loan Type" value={viewing.loanType} />
              <Row label="Created" value={fmt(viewing.createdAt)} />
              <Row label="Updated" value={fmt(viewing.updatedAt)} />

              {perms.canChangeStatus && (
                <TextField
                  size="small"
                  select
                  label="Change Status"
                  value={viewing.status || ''}
                  disabled={savingStatus}
                  sx={{ mt: 1, minWidth: 220 }}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next === viewing.status) return
                    setStatusDialog({ open: true, next, application: viewing })
                  }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              )}

              {viewing.statusHistory?.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Status history</Typography>
                  {viewing.statusHistory.map((h, i) => (
                    <Typography key={i} variant="caption" display="block" color="text.secondary">
                      {(h.from || '—')} &rarr; {h.to} · {fmt(h.changedAt)}
                    </Typography>
                  ))}
                </Box>
              )}
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Personal Information</Typography>
              <Row label="Email" value={viewing.email} />
              <Row label="Phone" value={viewing.phone} />
              <Row label="Date of Birth" value={fmt(viewing.dob)} />
              <Row label="Gender" value={viewing.gender} />
              <Row label="PAN" value={viewing.pan} />
              <Row label="Aadhaar" value={viewing.aadhaar} />
              <Row label="Address" value={viewing.address} />
              <Row label="City" value={viewing.city} />
              <Row label="State" value={viewing.state} />
              <Row label="Pincode" value={viewing.pincode} />
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Loan Details</Typography>
              <Row label="Amount" value={money(viewing.loanAmount)} />
              <Row label="Tenure" value={viewing.tenure ? `${viewing.tenure} months` : '—'} />
              <Row label="Purpose" value={viewing.loanPurpose} />
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Employment / Business</Typography>
              <Row label="Employment Type" value={viewing.employmentType} />
              <Row label="Monthly Income" value={money(viewing.monthlyIncome)} />
              <Row label="Work Experience" value={viewing.workExperience} />
              <Row label="Business Name" value={viewing.businessName} />
              <Row label="Business Type" value={viewing.businessType} />
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Consent</Typography>
              <Row label="Accepted" value={viewing.consentAccepted ? 'Yes' : 'Not recorded'} />
              <Row label="Accepted At" value={viewing.consentAcceptedAt ? fmt(viewing.consentAcceptedAt) : '—'} />
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Documents</Typography>
              {DOCUMENTS.every((d) => !viewing[d.key]) && (
                <Typography variant="body2" color="text.disabled">No documents uploaded</Typography>
              )}
              <Stack spacing={0.5}>
                {DOCUMENTS.filter((d) => viewing[d.key]).map((d) => (
                  <Link
                    key={d.key}
                    href={viewing[d.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {d.label} <OpenInNew fontSize="inherit" />
                  </Link>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setViewing(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={statusDialog.open}
        title="Change application status"
        message={statusDialog.application
          ? `Change ${statusDialog.application.applicationNumber} from "${statusDialog.application.status}" to "${statusDialog.next}"?`
          : ''}
        confirmLabel={savingStatus ? 'Updating…' : 'Confirm'}
        confirmColor={statusDialog.next === 'rejected' ? 'error' : 'primary'}
        loading={savingStatus}
        onConfirm={applyStatusChange}
        onCancel={() => { if (!savingStatus) setStatusDialog({ open: false, next: '', application: null }) }}
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

export default LoanApplicationsPage
