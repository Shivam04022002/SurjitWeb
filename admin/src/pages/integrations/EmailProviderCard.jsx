import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, TextField, Button, Chip, Alert, Divider,
  IconButton, InputAdornment, CircularProgress, Grid
} from '@mui/material'
import {
  Visibility, VisibilityOff, Save, Close, NetworkCheck, Email
} from '@mui/icons-material'
import { usePagePermission } from '../../hooks/usePermissions'
import { emailSettingsService } from '../../services/emailSettings.service'
import {
  defaultProvider, validateProvider, providerFromConfig, providerPayload, secretStoredIn,
  isDirty, firstErrorField, PROVIDER_FIELD_ORDER, serverFieldErrors, requestErrorMessage, providerStatus
} from './emailSettings'

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

// Label beside value from small tablets up; stacked on phones.
const StatusRow = ({ label, children }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} sx={{ py: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 150 }, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
  </Stack>
)

const fieldId = (field) => `email-provider-${field}`

// The Microsoft 365 credentials the CMS sends email with: the app registration
// in Microsoft Entra ID, signed in to with the client-credentials flow and the
// Mail.Send application permission, and the mailbox it sends as. Recipients
// and the notification preference are on Email Settings; both pages edit the
// same server-side configuration.
//
// The client secret is typed once, stored encrypted on the server, and shown
// afterwards only by its last four characters.
const EmailProviderCard = ({ showToast }) => {
  const { canEdit } = usePagePermission('integrations')
  const readOnly = !canEdit
  const { hash } = useLocation()
  const cardRef = useRef(null)

  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(defaultProvider)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const apply = (c) => {
    setConfig(c)
    setForm(providerFromConfig(c))
    setTouched({})
    setSubmitted(false)
    setServerErrors({})
    setShowSecret(false)
  }

  // State is set only once the request settles.
  const fetchConfig = useCallback(() => emailSettingsService.getSettings()
    .then((res) => { apply(res.data.config); setLoadError('') })
    .catch((err) => setLoadError(requestErrorMessage(err, 'Could not load the email provider settings.')))
    .finally(() => setLoading(false)), [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  // Email Settings links here; bring the card into view once it has content.
  useEffect(() => {
    if (!loading && hash === '#email-provider') cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, hash])

  const baseline = providerFromConfig(config)
  const secretStored = secretStoredIn(config)
  const errors = validateProvider(form, { secretStored })
  const dirty = isDirty(form, baseline)
  const status = providerStatus(config)
  const secretInfo = config?.clientSecret

  const errorFor = (field) => serverErrors[field] || ((touched[field] || submitted) ? errors[field] || '' : '')

  const fieldProps = (field) => ({
    id: fieldId(field),
    value: form[field],
    onChange: (e) => {
      const value = e.target.value
      setForm((f) => ({ ...f, [field]: value }))
      setServerErrors((s) => {
        if (!s[field]) return s
        const next = { ...s }
        delete next[field]
        return next
      })
      setTestResult(null)
    },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
    error: !!errorFor(field),
    disabled: readOnly || saving,
    fullWidth: true
  })

  const focusField = (field) => requestAnimationFrame(() => document.getElementById(fieldId(field))?.focus())

  const handleSave = async (e) => {
    e?.preventDefault()
    if (readOnly || saving) return
    setSubmitted(true)
    setTestResult(null)
    const first = firstErrorField(errors, PROVIDER_FIELD_ORDER)
    if (first) {
      focusField(first)
      return
    }
    setSaving(true)
    try {
      const res = await emailSettingsService.saveProvider(providerPayload(form))
      apply(res.data.config)
      showToast(form.clientSecret.trim() ? 'Email provider saved. The client secret is stored encrypted.' : 'Email provider saved')
    } catch (err) {
      const fieldErrs = serverFieldErrors(err)
      setServerErrors(fieldErrs)
      const first2 = firstErrorField(fieldErrs, PROVIDER_FIELD_ORDER)
      if (first2) focusField(first2)
      showToast(`Not saved: ${requestErrorMessage(err, 'the server could not save the email provider.')}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(baseline)
    setTouched({})
    setSubmitted(false)
    setServerErrors({})
    setShowSecret(false)
  }

  // Tests what is saved, so it waits for a save.
  const testBlockedReason = readOnly
    ? 'Testing needs edit access to API Settings.'
    : !config?.settings?.tenantId
      ? 'Save the provider settings first.'
      : dirty
        ? 'Save or cancel your changes first — the test uses the saved settings.'
        : !config.provider?.configured
          ? 'Complete the provider settings first.'
          : ''

  const handleTest = async () => {
    if (testBlockedReason || testing) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await emailSettingsService.testConnection()
      setConfig(res.data.config)
      setTestResult(res.data.result)
    } catch (err) {
      setTestResult({ ok: false, message: requestErrorMessage(err, 'The connection test could not be run.') })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, scrollMarginTop: 80 }} id="email-provider" ref={cardRef}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Email color="action" />
        <Typography variant="subtitle1" fontWeight={600} component="h2">Email API — Microsoft 365</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The CMS sends email through Microsoft Graph as the sender mailbox, signed in as your app registration in Microsoft Entra ID.
        Grant the app the <strong>Mail.Send</strong> application permission with admin consent. Recipients and loan application emails are set on Email Settings.
      </Typography>

      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have read-only access to the email provider. Changes and tests need edit access — ask a Super Admin.
        </Alert>
      )}
      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} aria-label="Loading email provider settings" /></Box>
      ) : !loadError && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Box component="form" noValidate onSubmit={handleSave} aria-label="Email provider settings">
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Directory (tenant) ID"
                    required
                    {...fieldProps('tenantId')}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    helperText={errorFor('tenantId') || 'A tenant ID, or a domain such as contoso.onmicrosoft.com.'}
                    slotProps={{ htmlInput: { spellCheck: false } }}
                  />
                  <TextField
                    label="Application (client) ID"
                    required
                    autoComplete="off"
                    {...fieldProps('clientId')}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    helperText={errorFor('clientId') || 'Shown on the app registration\'s overview.'}
                    slotProps={{ htmlInput: { spellCheck: false } }}
                  />
                </Stack>
                <TextField
                  label={secretStored ? 'Replace client secret' : 'Client secret'}
                  type={showSecret ? 'text' : 'password'}
                  required={!secretStored}
                  autoComplete="new-password"
                  {...fieldProps('clientSecret')}
                  placeholder={secretStored ? `Stored, ends in ${secretInfo.hint} — leave blank to keep it` : 'The secret Value from Certificates & secrets'}
                  helperText={errorFor('clientSecret') || (secretInfo?.configured && !secretInfo.readable
                    ? 'The stored secret can no longer be read by the server. Enter it again.'
                    : 'Stored encrypted on the server. It is never shown again after saving.')}
                  slotProps={{
                    htmlInput: { spellCheck: false, 'data-lpignore': 'true' },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showSecret ? 'Hide client secret' : 'Show client secret'}
                            onClick={() => setShowSecret((s) => !s)}
                            edge="end"
                            disabled={readOnly || !form.clientSecret}
                          >
                            {showSecret ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Sender mailbox"
                    type="email"
                    required
                    autoComplete="off"
                    {...fieldProps('senderEmail')}
                    helperText={errorFor('senderEmail') || 'A licensed Microsoft 365 mailbox in your tenant.'}
                  />
                  <TextField
                    label="Sender display name"
                    {...fieldProps('senderName')}
                    placeholder="Surjit Finance"
                    helperText={errorFor('senderName') || 'Optional. Shown as the "From" name.'}
                  />
                </Stack>

                {testResult && (
                  <Alert severity={testResult.ok ? 'success' : 'error'} role="alert">{testResult.message}</Alert>
                )}

                {!readOnly && (
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                      disabled={saving || testing || !dirty}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="outlined" startIcon={<Close />} onClick={handleCancel} disabled={saving || !dirty}>
                      Cancel
                    </Button>
                    {dirty && <Typography variant="body2" color="text.secondary">Unsaved changes</Typography>}
                  </Stack>
                )}
              </Stack>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Connection status</Typography>
            <StatusRow label="Status"><Chip size="small" color={status.color} label={status.label} /></StatusRow>
            <StatusRow label="Client secret">
              <Typography variant="body2" sx={{ fontFamily: secretInfo?.configured ? 'monospace' : undefined }} color={secretInfo?.configured ? 'text.primary' : 'text.secondary'}>
                {!secretInfo?.configured ? 'Not stored' : secretInfo.readable ? `••••••••${secretInfo.hint}` : 'Unreadable — enter it again'}
              </Typography>
            </StatusRow>
            {config?.settings?.tenantId && !config.provider?.configured && (
              <StatusRow label="Missing">
                <Stack component="ul" sx={{ m: 0, pl: 2 }} spacing={0.25}>
                  {config.provider.missing.map((m) => <Typography key={m} component="li" variant="body2">{m}</Typography>)}
                </Stack>
              </StatusRow>
            )}
            <StatusRow label="Last test">
              {config?.lastTest ? (
                <Stack spacing={0.5}>
                  <Chip size="small" sx={{ alignSelf: 'flex-start' }} color={config.lastTest.ok ? 'success' : 'error'} label={config.lastTest.ok ? 'Passed' : 'Failed'} />
                  <Typography variant="caption" color="text.secondary">{formatDateTime(config.lastTest.at)} — {config.lastTest.message}</Typography>
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">Not tested since the settings were saved</Typography>}
            </StatusRow>
            <StatusRow label="Last updated"><Typography variant="body2">{formatDateTime(config?.updatedAt)}</Typography></StatusRow>
            <Divider sx={{ my: 1 }} />
            <Button
              variant="outlined"
              fullWidth
              startIcon={testing ? <CircularProgress size={16} /> : <NetworkCheck />}
              onClick={handleTest}
              disabled={!!testBlockedReason || testing || saving}
              aria-describedby="email-provider-test-help"
              sx={{ mt: 1 }}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" id="email-provider-test-help" sx={{ mt: 1 }}>
              {testBlockedReason || 'Signs in to Microsoft with the saved app credentials and checks the Mail.Send permission. Nothing is sent.'}
            </Typography>
          </Grid>
        </Grid>
      )}
    </Paper>
  )
}

export default EmailProviderCard
