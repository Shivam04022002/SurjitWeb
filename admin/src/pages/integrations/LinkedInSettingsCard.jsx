import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Stack, Button, Chip, Alert, CircularProgress, Grid, TextField,
  IconButton, InputAdornment, Tooltip, FormControlLabel, Switch, Divider
} from '@mui/material'
import {
  LinkedIn, CheckCircle, ErrorOutline, LinkOff, Sync, Save, NetworkCheck,
  Visibility, VisibilityOff, ContentCopy, Cancel, RemoveCircleOutline, WarningAmber
} from '@mui/icons-material'
import { linkedinService } from '../../services/linkedin.service'
import { usePermissions } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { RECONNECT_REASONS } from '../blog/linkedinShare'
import {
  ENV_VARIABLES, isEnvManaged, formFromConfig, validateForm, buildPayload, isDirty,
  reconnectReasons, outcomeSeverity, modeLabel, serverFieldErrors
} from './linkedinSettings'

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

const StatusRow = ({ label, children }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} sx={{ py: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 150 }, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
  </Stack>
)

const STATE_CHIPS = {
  connected: { color: 'success', icon: <CheckCircle />, label: 'Connected' },
  reconnect_required: { color: 'warning', icon: <ErrorOutline />, label: 'Reconnect required' },
  not_connected: { color: 'default', icon: null, label: 'Not connected' },
  not_configured: { color: 'default', icon: null, label: 'Not configured' }
}

const CHECK_ICONS = {
  pass: <CheckCircle fontSize="small" color="success" />,
  fail: <Cancel fontSize="small" color="error" />,
  warn: <WarningAmber fontSize="small" color="warning" />,
  skip: <RemoveCircleOutline fontSize="small" color="disabled" />
}

const envHelper = (field) => `Set by the server environment (${ENV_VARIABLES[field]}); change it there.`

// LinkedIn company-page publishing: the app's credentials, Test
// Configuration, and the OAuth connection. Connecting sends the admin to
// LinkedIn to sign in and approve; the CMS never asks for a LinkedIn password,
// and the stored client secret and tokens never come back to the browser.
const LinkedInSettingsCard = ({ showToast }) => {
  const perms = usePermissions()
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState(null)
  const [form, setForm] = useState(formFromConfig(null))
  const [errors, setErrors] = useState({})
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmSave, setConfirmSave] = useState([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [starting, setStarting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const applyConfig = (cfg) => {
    setConfig(cfg)
    setForm(formFromConfig(cfg))
    setErrors({})
  }

  const load = useCallback(() => Promise.all([linkedinService.getConfig(), linkedinService.getConnection()])
    .then(([cfgRes, connRes]) => {
      applyConfig(cfgRes.data.config)
      setStatus(connRes.data.connection)
      setLoadError('')
    })
    .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load the LinkedIn settings.'))
    .finally(() => setLoading(false)), [])

  useEffect(() => { load() }, [load])

  const handleChange = (field) => (e) => {
    const value = field === 'verifyRole' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((x) => ({ ...x, [field]: '' }))
  }

  const doSave = async () => {
    setConfirmSave([])
    setSaving(true)
    try {
      const res = await linkedinService.saveConfig(buildPayload(form, config))
      applyConfig(res.data.config)
      setStatus(res.data.connection)
      setShowSecret(false)
      setTestResult(null)
      showToast(res.data.connectionImpact?.length
        ? 'LinkedIn settings saved. The existing connection must now be renewed — click Reconnect.'
        : 'LinkedIn settings saved', res.data.connectionImpact?.length ? 'warning' : 'success')
    } catch (err) {
      setErrors(serverFieldErrors(err))
      showToast(err?.response?.data?.message || 'Could not save the LinkedIn settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const found = validateForm(form, config)
    setErrors(found)
    if (Object.keys(found).length) return
    const reasons = reconnectReasons(form, config, status)
    if (reasons.length) setConfirmSave(reasons)
    else doSave()
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await linkedinService.testConfig()
      setTestResult(res.data.result)
      setStatus(res.data.connection)
    } catch (err) {
      setTestResult({ mode: 'readiness', outcome: 'API_REQUEST_FAILED', title: err?.response?.data?.message || 'The test could not be run.', checks: [] })
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    setStarting(true)
    try {
      const res = await linkedinService.startAuthorization()
      // Leave the CMS for LinkedIn's own sign-in page.
      window.location.assign(res.data.authorizationUrl)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not start the LinkedIn connection', 'error')
      setStarting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await linkedinService.disconnect()
      setStatus(res.data.connection)
      setTestResult(null)
      showToast('LinkedIn disconnected')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not disconnect LinkedIn', 'error')
    } finally {
      setDisconnecting(false)
      setConfirmDisconnect(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config.redirectUri.value)
      showToast('Redirect URI copied')
    } catch {
      showToast('Could not copy; select the address and copy it manually', 'error')
    }
  }

  const chip = status ? STATE_CHIPS[status.state] : null
  const hasConnection = status && (status.state === 'connected' || status.state === 'reconnect_required')
  const canEdit = perms.canEdit
  const dirty = config ? isDirty(form, config) : false
  const managed = (field) => isEnvManaged(config, field)
  const fieldProps = (field) => ({
    value: form[field],
    onChange: handleChange(field),
    error: !!errors[field],
    disabled: !canEdit || saving || managed(field),
    fullWidth: true,
    size: 'small'
  })

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
        <LinkedIn sx={{ color: '#0a66c2' }} />
        <Typography variant="subtitle1" fontWeight={600}>LinkedIn Company Page</Typography>
        {chip && <Chip size="small" color={chip.color} icon={chip.icon || undefined} label={chip.label} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lets editors share published blogs to the Surjit Finance LinkedIn page from the Blogs list. Enter the LinkedIn app's
        credentials, save, then connect with a LinkedIn account that is an Administrator or Content Admin of the page — you sign in
        on LinkedIn itself, never here.
      </Typography>

      {loading && <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}
      {loadError && <Alert severity="error">{loadError}</Alert>}

      {config && status && (
        <Grid container spacing={3}>
          {/* ── App credentials ── */}
          <Grid item xs={12} md={7}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>App credentials</Typography>
            <Stack spacing={2}>
              <TextField
                label="Client ID" required {...fieldProps('clientId')}
                helperText={errors.clientId || (managed('clientId') ? envHelper('clientId') : 'From the LinkedIn app\'s Auth tab')}
                inputProps={{ maxLength: 64, autoComplete: 'off', spellCheck: false }}
              />
              <TextField
                label="Client Secret" required={!config.clientSecret.configured}
                {...fieldProps('clientSecret')}
                type={showSecret ? 'text' : 'password'}
                placeholder={config.clientSecret.configured ? '•••••••••••• (stored — leave blank to keep)' : ''}
                helperText={errors.clientSecret || (managed('clientSecret')
                  ? envHelper('clientSecret')
                  : !config.clientSecret.readable
                    ? 'The stored secret can no longer be decrypted; enter it again.'
                    : config.clientSecret.configured
                      ? 'A secret is stored encrypted on the server and is never shown. Type a new one only to replace it.'
                      : 'The Primary Client Secret from the Auth tab. Stored encrypted; never shown again.')}
                inputProps={{ maxLength: 256, autoComplete: 'new-password', spellCheck: false }}
                InputLabelProps={config.clientSecret.configured ? { shrink: true } : undefined}
                InputProps={{
                  endAdornment: !managed('clientSecret') && (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label={showSecret ? 'Hide secret' : 'Show secret'} onClick={() => setShowSecret((s) => !s)} edge="end">
                        {showSecret ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Company page ID" required {...fieldProps('organizationId')}
                  helperText={errors.organizationId || (managed('organizationId') ? envHelper('organizationId') : 'The digits in urn:li:organization:…')}
                  inputProps={{ inputMode: 'numeric', maxLength: 60 }}
                />
                <TextField
                  label="API version" {...fieldProps('apiVersion')}
                  helperText={errors.apiVersion || (managed('apiVersion') ? envHelper('apiVersion') : config.apiVersion.warning || 'LinkedIn-Version header, YYYYMM')}
                  inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                  sx={{ maxWidth: { sm: 200 } }}
                />
              </Stack>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>OAuth redirect URI</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    value={config.redirectUri.value || 'Not set on the server (LINKEDIN_REDIRECT_URI)'}
                    size="small" fullWidth disabled
                    error={!config.redirectUri.value}
                    inputProps={{ 'aria-label': 'OAuth redirect URI', readOnly: true }}
                  />
                  <Tooltip title="Copy">
                    <span>
                      <IconButton aria-label="Copy redirect URI" disabled={!config.redirectUri.value} onClick={handleCopy}>
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Add exactly this address under Authorized redirect URLs on the LinkedIn app's Auth tab. It is set by the server
                  (LINKEDIN_REDIRECT_URI) and cannot be changed here.
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Permissions requested at Connect</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                  {config.scopes.value.map((s) => <Chip key={s} size="small" variant="outlined" label={s} />)}
                </Stack>
                <FormControlLabel
                  control={<Switch checked={form.verifyRole} onChange={handleChange('verifyRole')} disabled={!canEdit || saving || managed('verifyRole')} />}
                  label="Verify the member's page role (requests r_organization_admin)"
                />
                <Typography variant="caption" color="text.secondary" component="div">
                  {managed('verifyRole')
                    ? envHelper('verifyRole')
                    : 'Turn off only if LinkedIn has not approved r_organization_admin for the app — otherwise sign-in fails. w_organization_social is always required.'}
                </Typography>
              </Box>

              {config.problems.length > 0 && (
                <Alert severity="info">
                  Still needed: {config.problems.map((p) => p.field === 'redirectUri' ? `redirect URI ${p.problem}` : p.field).join(', ')}.
                </Alert>
              )}

              {canEdit && (
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained" onClick={handleSave} disabled={saving || !dirty}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  >
                    {saving ? 'Saving…' : 'Save settings'}
                  </Button>
                  {dirty && (
                    <Button onClick={() => applyConfig(config)} disabled={saving}>Discard changes</Button>
                  )}
                </Stack>
              )}
            </Stack>
          </Grid>

          {/* ── Connection ── */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Connection</Typography>
            {status.state === 'reconnect_required' && (
              <Alert severity="warning" sx={{ my: 1 }}>
                Publishing is paused. {RECONNECT_REASONS[status.reconnectCode] || 'The connection is no longer usable.'} Reconnect to resume.
              </Alert>
            )}
            {status.lastAttempt && status.lastAttempt.ok === false && (
              <Alert severity="error" sx={{ my: 1 }}>
                Last connection attempt failed ({status.lastAttempt.code}) on {formatDateTime(status.lastAttempt.at)}.
              </Alert>
            )}
            <StatusRow label="Company page">
              <Typography variant="body2">{status.organizationId ? `ID ${status.organizationId}` : '—'}</Typography>
            </StatusRow>
            {hasConnection ? (
              <>
                <StatusRow label="Page role">
                  {status.roleVerification.status === 'verified'
                    ? <Typography variant="body2">Verified: {status.roleVerification.role}</Typography>
                    : <Typography variant="body2" color="text.secondary">Not verified</Typography>}
                </StatusRow>
                <StatusRow label="Connected">
                  <Typography variant="body2">{formatDateTime(status.connectedAt)}{status.connectedBy ? ` by ${status.connectedBy.name}` : ''}</Typography>
                </StatusRow>
                <StatusRow label="Authorization">
                  <Typography variant="body2">
                    Expires {formatDateTime(status.accessTokenExpiresAt)}
                    {status.refreshAvailable ? ' (renewed automatically)' : ' — reconnect before then'}
                  </Typography>
                </StatusRow>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                {status.state === 'not_configured' ? 'Save complete settings, then connect.' : 'Settings saved. Connect LinkedIn to authorize publishing.'}
              </Typography>
            )}

            {canEdit && (
              <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined" onClick={handleTest} disabled={testing || dirty}
                  startIcon={testing ? <CircularProgress size={16} /> : <NetworkCheck />}
                >
                  Test Configuration
                </Button>
                <Button
                  variant="contained"
                  startIcon={starting ? <CircularProgress size={16} color="inherit" /> : (hasConnection ? <Sync /> : <LinkedIn />)}
                  disabled={starting || dirty || status.state === 'not_configured'}
                  onClick={handleConnect}
                >
                  {hasConnection ? 'Reconnect' : 'Connect LinkedIn'}
                </Button>
                {hasConnection && (
                  <Button variant="outlined" color="error" startIcon={<LinkOff />} onClick={() => setConfirmDisconnect(true)}>
                    Disconnect
                  </Button>
                )}
              </Stack>
            )}
            {canEdit && dirty && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                Save or discard your changes before testing or connecting.
              </Typography>
            )}

            {testResult && (
              <Alert severity={outcomeSeverity(testResult.outcome)} sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600}>{testResult.title}</Typography>
                <Typography variant="caption" component="div" sx={{ mb: 1 }}>{modeLabel(testResult.mode)}</Typography>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.75}>
                  {testResult.checks.map((c) => (
                    <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start">
                      <Box sx={{ pt: '1px' }}>{CHECK_ICONS[c.status]}</Box>
                      <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}><strong>{c.label}:</strong> {c.message}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Alert>
            )}
          </Grid>
        </Grid>
      )}

      <ConfirmDialog
        open={confirmSave.length > 0}
        title="Reconnect will be required"
        message={`Changing ${confirmSave.join(' and ')} ends the current LinkedIn connection: sharing stops until someone clicks Reconnect and authorizes again. Save anyway?`}
        confirmLabel="Save"
        onConfirm={doSave}
        onCancel={() => setConfirmSave([])}
        loading={saving}
      />
      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect LinkedIn"
        message="The stored LinkedIn authorization will be deleted and blogs can no longer be shared until someone connects again. The app settings are kept, and posts already on LinkedIn are not affected. To fully revoke the app, also remove it from the LinkedIn account's settings. Continue?"
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
        loading={disconnecting}
      />
    </Paper>
  )
}

export default LinkedInSettingsCard
