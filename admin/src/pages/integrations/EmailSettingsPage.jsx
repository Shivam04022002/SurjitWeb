import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Paper, Stack, TextField, Button, Chip, Alert, Divider, Grid,
  FormControlLabel, Switch, IconButton, List, ListItem, ListItemText, CircularProgress, Link
} from '@mui/material'
import {
  Save, Close, Send, Add, DeleteOutline, People, NotificationsActive, Refresh, Api
} from '@mui/icons-material'
import { usePagePermission } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { emailSettingsService } from '../../services/emailSettings.service'
import {
  MAX_ADDITIONAL_RECIPIENTS, addRecipient, removeRecipient, validateRecipients, recipientsFromConfig,
  recipientsPayload, testRecipientError, isDirty, firstErrorField, RECIPIENT_FIELD_ORDER,
  serverFieldErrors, requestErrorMessage, providerStatus, notificationReadiness, EMAIL_API_PATH
} from './emailSettings'

// Email Settings sits under the API Settings permission, like the Email API
// card that holds the credentials; the server applies the same rule to who may
// see this page, change it and send tests.
const PAGE_KEY = 'integrations'

const fieldId = (field) => `email-${field.replace('.', '-')}`

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

// Label beside value from small tablets up; stacked on phones, where a fixed
// label column left too little room and pushed the page sideways.
const StatusRow = ({ label, children }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} sx={{ py: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 130 }, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
  </Stack>
)

const SectionTitle = ({ icon: Icon, children, id }) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
    <Icon color="action" />
    <Typography variant="subtitle1" fontWeight={600} component="h2" id={id}>{children}</Typography>
  </Stack>
)

const TEST_KIND_LABELS = { connection: 'Test Connection', email: 'Test email' }

const ApiSectionLink = ({ children = 'API section' }) => (
  <Link component={RouterLink} to={EMAIL_API_PATH}>{children}</Link>
)

const EmailSettingsPage = () => {
  const { canEdit } = usePagePermission(PAGE_KEY)
  const readOnly = !canEdit

  // What the server last reported: the recipients this page edits, and the
  // provider status the API section sets.
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const baseline = useMemo(() => recipientsFromConfig(config), [config])
  const [form, setForm] = useState(baseline)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [newRecipient, setNewRecipient] = useState('')
  const [newRecipientError, setNewRecipientError] = useState('')
  const [testRecipient, setTestRecipient] = useState('')
  const [testRecipientMessage, setTestRecipientMessage] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const errors = useMemo(() => validateRecipients(form), [form])
  const dirty = isDirty(form, baseline)

  // State is set only once the request settles, so the effect below never
  // updates state synchronously.
  const fetchSettings = useCallback(() => emailSettingsService.getSettings()
    .then((res) => {
      setConfig(res.data.config)
      setForm(recipientsFromConfig(res.data.config))
      setLoadError('')
    })
    .catch((err) => setLoadError(requestErrorMessage(err, 'Could not load the email settings.')))
    .finally(() => setLoading(false)), [])

  // The route guard has already refused anyone without integrations.view.
  useEffect(() => { fetchSettings() }, [fetchSettings])

  const retryLoad = () => {
    setLoading(true)
    setLoadError('')
    fetchSettings()
  }

  // Closing or reloading the tab with unsaved changes asks first. In-app
  // navigation cannot be held back under this router.
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // A server error for a field shows until that field changes. A local error
  // shows once its field has been left, or after a save attempt.
  const errorFor = (field) => serverErrors[field] || ((touched[field] || submitted) ? errors[field] || '' : '')

  const clearServerError = (field) => setServerErrors((s) => {
    if (!s[field]) return s
    const next = { ...s }
    delete next[field]
    return next
  })

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    clearServerError(field)
    setSaveNotice(null)
  }

  const handleAddRecipient = () => {
    const result = addRecipient(form, newRecipient)
    if (result.error) {
      setNewRecipientError(result.error)
      return
    }
    setForm((f) => ({ ...f, additionalRecipients: result.additionalRecipients }))
    clearServerError('additionalRecipients')
    setNewRecipient('')
    setNewRecipientError('')
    setSaveNotice(null)
  }

  const handleRemoveRecipient = (index) => {
    setForm((f) => ({ ...f, additionalRecipients: removeRecipient(f.additionalRecipients, index) }))
    clearServerError('additionalRecipients')
    setSaveNotice(null)
    // The button that had focus is gone; the add field is the natural next stop.
    requestAnimationFrame(() => document.getElementById(fieldId('newRecipient'))?.focus())
  }

  const focusField = (key) => {
    const target = key.startsWith('additionalRecipients.')
      ? `${fieldId(key)}-remove`
      : key === 'additionalRecipients' ? fieldId('newRecipient') : fieldId(key)
    requestAnimationFrame(() => document.getElementById(target)?.focus())
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (readOnly || saving) return
    setSubmitted(true)
    const first = firstErrorField(errors, RECIPIENT_FIELD_ORDER)
    if (first) {
      const count = Object.keys(errors).length
      setSaveNotice({ severity: 'error', message: `Not saved: ${count === 1 ? '1 field needs' : `${count} fields need`} attention.` })
      focusField(first)
      return
    }

    setSaving(true)
    setSaveNotice(null)
    try {
      const res = await emailSettingsService.saveRecipients(recipientsPayload(form))
      setConfig(res.data.config)
      setForm(recipientsFromConfig(res.data.config))
      setTouched({})
      setSubmitted(false)
      setServerErrors({})
      setSaveNotice({ severity: 'success', message: 'Notification settings saved.' })
    } catch (err) {
      const fieldErrs = serverFieldErrors(err)
      setServerErrors(fieldErrs)
      setSaveNotice({ severity: 'error', message: `Not saved: ${requestErrorMessage(err, 'the server could not save the settings.')}` })
      const first2 = firstErrorField(fieldErrs, RECIPIENT_FIELD_ORDER)
      if (first2) focusField(first2)
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setForm(baseline)
    setTouched({})
    setSubmitted(false)
    setServerErrors({})
    setNewRecipient('')
    setNewRecipientError('')
    setSaveNotice(null)
    setConfirmCancel(false)
  }

  const handleCancel = () => {
    if (dirty || newRecipient.trim()) setConfirmCancel(true)
  }

  // A test email uses the provider saved in the API section and the address
  // typed here — not the recipients — so unsaved recipient edits do not
  // hold it back.
  const providerReady = !!config?.provider?.configured
  const testBlockedReason = readOnly
    ? 'Testing needs edit access to API Settings.'
    : !providerReady
      ? 'Configure the email provider in the API section first.'
      : ''

  const sendTest = async () => {
    if (testBlockedReason || sending) return
    const message = testRecipientError(testRecipient, { required: true })
    setTestRecipientMessage(message)
    if (message) {
      requestAnimationFrame(() => document.getElementById(fieldId('testRecipient'))?.focus())
      return
    }
    setSending(true)
    setTestResult(null)
    try {
      const res = await emailSettingsService.sendTestEmail(testRecipient.trim())
      setConfig(res.data.config)
      setTestResult(res.data.result)
    } catch (err) {
      setTestRecipientMessage(serverFieldErrors(err).recipient || '')
      setTestResult({ ok: false, message: requestErrorMessage(err, 'The test email could not be sent.') })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress aria-label="Loading email settings" /></Box>
  }

  if (loadError) {
    // Without the saved settings there is nothing safe to edit: a save from a
    // blank form would overwrite them.
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} component="h1" sx={{ mb: 2 }}>Email Settings</Typography>
        <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<Refresh />} onClick={retryLoad}>Retry</Button>}>
          {loadError}
        </Alert>
      </Container>
    )
  }

  const additionalCount = form.additionalRecipients.length
  const status = providerStatus(config)
  const readiness = notificationReadiness(config)
  const busy = saving || sending

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} component="h1">Email Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Who is emailed about new loan applications, and whether they are
        </Typography>
      </Box>

      {providerReady ? (
        <Alert severity="success" sx={{ mb: 3 }} icon={<Api fontSize="inherit" />}>
          Email is sent through Microsoft 365 as <strong>{config.settings.senderEmail}</strong>.
          {' '}The provider credentials are managed in the <ApiSectionLink />.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          The email provider is not set up, so no email can be sent. An administrator must configure Microsoft 365 in the <ApiSectionLink /> first.
          {config?.provider?.missing?.length > 0 && config.settings?.tenantId ? ` Missing: ${config.provider.missing.join('; ')}.` : ''}
        </Alert>
      )}

      {readOnly && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have read-only access to email settings. Changes and tests need edit access — ask a Super Admin.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box component="form" noValidate onSubmit={handleSave} aria-label="Email notification settings">
            <Stack spacing={3}>
              {/* ── Recipients ──────────────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={People}>Notification recipients</SectionTitle>
                <Stack spacing={2.5}>
                  <TextField
                    id={fieldId('primaryRecipient')}
                    label="Primary recipient"
                    type="email"
                    required
                    autoComplete="off"
                    value={form.primaryRecipient}
                    onChange={update('primaryRecipient')}
                    onBlur={() => setTouched((t) => ({ ...t, primaryRecipient: true }))}
                    error={!!errorFor('primaryRecipient')}
                    helperText={errorFor('primaryRecipient') || 'Receives every notification.'}
                    disabled={readOnly || saving}
                    fullWidth
                  />

                  <Box>
                    <Typography variant="body2" fontWeight={600} id="email-additional-label">
                      Additional recipients ({additionalCount} of {MAX_ADDITIONAL_RECIPIENTS})
                    </Typography>
                    {additionalCount === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>None added.</Typography>
                    ) : (
                      <List dense aria-labelledby="email-additional-label" sx={{ py: 0.5 }}>
                        {form.additionalRecipients.map((r, i) => {
                          // Shown at once: an entry passed its check when added, so
                          // an error here means the primary recipient changed to match it.
                          const err = errors[`additionalRecipients.${i}`]
                          return (
                            <ListItem
                              key={r}
                              disableGutters
                              secondaryAction={(
                                <IconButton
                                  edge="end"
                                  id={`${fieldId(`additionalRecipients.${i}`)}-remove`}
                                  aria-label={`Remove ${r}`}
                                  onClick={() => handleRemoveRecipient(i)}
                                  disabled={readOnly || saving}
                                >
                                  <DeleteOutline />
                                </IconButton>
                              )}
                              sx={{ borderBottom: 1, borderColor: 'divider', pr: 6 }}
                            >
                              <ListItemText
                                primary={r}
                                secondary={err || null}
                                slotProps={{
                                  primary: { sx: { wordBreak: 'break-all' } },
                                  secondary: { color: 'error', role: 'alert' }
                                }}
                              />
                            </ListItem>
                          )
                        })}
                      </List>
                    )}
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                    <TextField
                      id={fieldId('newRecipient')}
                      label="Add recipient"
                      type="email"
                      autoComplete="off"
                      value={newRecipient}
                      onChange={(e) => { setNewRecipient(e.target.value); setNewRecipientError('') }}
                      onKeyDown={(e) => {
                        // Enter adds the address rather than submitting the form.
                        if (e.key === 'Enter') { e.preventDefault(); handleAddRecipient() }
                      }}
                      error={!!(newRecipientError || errorFor('additionalRecipients'))}
                      helperText={newRecipientError || errorFor('additionalRecipients') || 'Press Enter or select Add.'}
                      disabled={readOnly || saving || additionalCount >= MAX_ADDITIONAL_RECIPIENTS}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={handleAddRecipient}
                      disabled={readOnly || saving || additionalCount >= MAX_ADDITIONAL_RECIPIENTS}
                      sx={{ flexShrink: 0, height: 56 }}
                    >
                      Add
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {/* ── Notifications and test ──────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={NotificationsActive}>Notifications</SectionTitle>
                <Stack spacing={2.5}>
                  <Box>
                    <FormControlLabel
                      control={(
                        <Switch
                          id={fieldId('notifyNewLoanApplication')}
                          checked={form.notifyNewLoanApplication}
                          onChange={update('notifyNewLoanApplication')}
                          disabled={readOnly || saving}
                          slotProps={{ input: { 'aria-describedby': 'email-notify-help' } }}
                        />
                      )}
                      label="Email the recipients when a new loan application is submitted"
                    />
                    <Typography variant="caption" color="text.secondary" display="block" id="email-notify-help">
                      Sent only when the email provider is set up, this is on, and a primary recipient is saved.
                    </Typography>
                  </Box>

                  <Divider />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                    <TextField
                      label="Test email recipient"
                      type="email"
                      autoComplete="off"
                      id={fieldId('testRecipient')}
                      value={testRecipient}
                      onChange={(e) => { setTestRecipient(e.target.value); setTestRecipientMessage('') }}
                      onKeyDown={(e) => {
                        // Enter sends the test rather than saving the form.
                        if (e.key === 'Enter') { e.preventDefault(); sendTest() }
                      }}
                      error={!!testRecipientMessage}
                      helperText={testRecipientMessage || 'Receives one fixed test message from the sender mailbox.'}
                      disabled={readOnly || busy}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      startIcon={sending ? <CircularProgress size={16} /> : <Send />}
                      onClick={sendTest}
                      disabled={!!testBlockedReason || busy}
                      aria-describedby={testBlockedReason ? 'email-test-reason' : undefined}
                      sx={{ flexShrink: 0, height: 56 }}
                    >
                      {sending ? 'Sending…' : 'Send Test Email'}
                    </Button>
                  </Stack>
                  {testBlockedReason && (
                    <Typography variant="caption" color="text.secondary" id="email-test-reason" sx={{ mt: -1.5 }}>
                      {testBlockedReason}
                    </Typography>
                  )}
                  {testResult && (
                    <Alert severity={testResult.ok ? 'success' : 'error'} role="alert">{testResult.message}</Alert>
                  )}
                </Stack>
              </Paper>

              {saveNotice && (
                <Alert severity={saveNotice.severity} role="alert">{saveNotice.message}</Alert>
              )}

              {!readOnly && (
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    disabled={busy}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Close />}
                    onClick={handleCancel}
                    disabled={busy || (!dirty && !newRecipient.trim())}
                  >
                    Cancel
                  </Button>
                  {dirty && (
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      Unsaved changes
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} component="h2" sx={{ mb: 1 }}>Status</Typography>
            <StatusRow label="Email provider">
              <Stack spacing={0.5}>
                <Chip size="small" sx={{ alignSelf: 'flex-start' }} color={status.color} label={status.label} />
                <ApiSectionLink>{providerReady ? 'Manage in API section' : 'Set up in API section'}</ApiSectionLink>
              </Stack>
            </StatusRow>
            {providerReady && (
              <StatusRow label="Sender">
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{config.settings.senderEmail}</Typography>
              </StatusRow>
            )}
            <StatusRow label="Recipients">
              <Typography variant="body2" color={config?.recipients?.configured ? 'text.primary' : 'text.secondary'}>
                {config?.recipients?.configured
                  ? `${1 + (config.settings.additionalRecipients?.length || 0)} saved`
                  : 'None saved'}
              </Typography>
            </StatusRow>
            <StatusRow label="Loan emails">
              <Chip size="small" color={readiness.ready ? 'success' : 'default'} label={readiness.ready ? 'On' : 'Not sending'} />
              {!readiness.ready && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{readiness.reason}</Typography>
              )}
            </StatusRow>
            <Divider sx={{ my: 1 }} />
            <StatusRow label="Last test">
              {config?.lastTest ? (
                <Stack spacing={0.5}>
                  <Chip
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                    color={config.lastTest.ok ? 'success' : 'error'}
                    label={`${TEST_KIND_LABELS[config.lastTest.kind] || 'Test'}: ${config.lastTest.ok ? 'passed' : 'failed'}`}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(config.lastTest.at)} — {config.lastTest.message}
                  </Typography>
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">Not tested since the provider was saved</Typography>}
            </StatusRow>
            <StatusRow label="Last updated">
              <Typography variant="body2">{formatDateTime(config?.updatedAt)}</Typography>
            </StatusRow>
          </Paper>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmCancel}
        title="Discard changes"
        message="Your changes on this page will be lost. Continue?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        onCancel={() => setConfirmCancel(false)}
      />
    </Container>
  )
}

export default EmailSettingsPage
