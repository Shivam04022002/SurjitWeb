import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, Container, Typography, Paper, Stack, TextField, Button, Chip, Alert, Divider, Grid,
  Radio, RadioGroup, FormControl, FormControlLabel, FormLabel, FormHelperText, Switch,
  MenuItem, IconButton, List, ListItem, ListItemText, CircularProgress
} from '@mui/material'
import {
  Save, Close, NetworkCheck, Send, Add, DeleteOutline, Email, Dns, Key, People, NotificationsActive, Refresh
} from '@mui/icons-material'
import { usePagePermission } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { emailSettingsService } from '../../services/emailSettings.service'
import {
  PROVIDERS, PROVIDER_KEYS, AUTH_METHODS, AUTH_METHOD_LABELS, ENCRYPTION, ENCRYPTION_LABELS,
  MAX_ADDITIONAL_RECIPIENTS, applyProvider, usesOAuth, usesSmtp, isSupported, isProviderAvailable,
  addRecipient, removeRecipient, validateEmailSettings, firstErrorField, isDirty, oauthPermissionHint,
  testRecipientError, formFromConfig, payloadFromForm, secretStoredIn, serverFieldErrors,
  requestErrorMessage, connectionStatus
} from './emailSettings'

// Email Settings sits under the API Settings permission: it holds the same
// kind of thing — credentials for a service the CMS calls — and the server
// applies the same rule to who may see it, change it and send tests.
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

// A select keeps its value on one line, and its width grows to fit it. Letting
// the value shrink (with an ellipsis) stops a long method name from widening
// the page on phones.
const selectSx = { '& .MuiSelect-select': { width: 0, flexGrow: 1 } }

const SectionTitle = ({ icon: Icon, children, id }) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
    <Icon color="action" />
    <Typography variant="subtitle1" fontWeight={600} component="h2" id={id}>{children}</Typography>
  </Stack>
)

const TEST_KIND_LABELS = { connection: 'Test Connection', email: 'Test email' }

const EmailSettingsPage = () => {
  const { canEdit } = usePagePermission(PAGE_KEY)
  const readOnly = !canEdit

  // What the server last reported. The form, the status panel and what Cancel
  // returns to are all derived from it.
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const baseline = useMemo(() => formFromConfig(config), [config])
  const [form, setForm] = useState(baseline)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [newRecipient, setNewRecipient] = useState('')
  const [newRecipientError, setNewRecipientError] = useState('')
  const [testRecipientMessage, setTestRecipientMessage] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState('')
  const [testResult, setTestResult] = useState(null)

  const secretStored = secretStoredIn(config)
  const errors = useMemo(() => validateEmailSettings(form, { secretStored }), [form, secretStored])
  const dirty = isDirty(form, baseline)
  const provider = PROVIDERS[form.provider]

  // State is set only once the request settles, so the effect below never
  // updates state synchronously.
  const fetchSettings = useCallback(() => emailSettingsService.getSettings()
    .then((res) => {
      setConfig(res.data.config)
      setForm(formFromConfig(res.data.config))
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

  const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }))

  const fieldProps = (field) => ({
    id: fieldId(field),
    value: form[field],
    onChange: update(field),
    onBlur: blur(field),
    error: !!errorFor(field),
    disabled: readOnly || saving,
    fullWidth: true
  })

  const handleProviderChange = (e) => {
    setForm((f) => applyProvider(f, e.target.value))
    clearServerError('provider')
    clearServerError('authMethod')
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
    // A radio group is reached through its checked option.
    const el = document.getElementById(target)
    const focusable = el?.matches('input, button, [tabindex]') ? el : el?.querySelector('input:checked, input, button')
    focusable?.focus()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (readOnly || saving) return
    setSubmitted(true)
    setTestResult(null)
    const first = firstErrorField(errors)
    if (first) {
      const count = Object.keys(errors).length
      setSaveNotice({ severity: 'error', message: `Not saved: ${count === 1 ? '1 field needs' : `${count} fields need`} attention.` })
      requestAnimationFrame(() => focusField(first))
      return
    }

    setSaving(true)
    setSaveNotice(null)
    try {
      const res = await emailSettingsService.saveSettings(payloadFromForm(form))
      const saved = res.data.config
      setConfig(saved)
      // The typed secret is dropped now that the server holds it; the test
      // address is not a setting and survives the save.
      setForm({ ...formFromConfig(saved), testRecipient: form.testRecipient })
      setTouched({})
      setSubmitted(false)
      setServerErrors({})
      setSaveNotice({ severity: 'success', message: 'Email settings saved.' })
    } catch (err) {
      const fieldErrs = serverFieldErrors(err)
      setServerErrors(fieldErrs)
      setSaveNotice({ severity: 'error', message: `Not saved: ${requestErrorMessage(err, 'the server could not save the settings.')}` })
      const first2 = firstErrorField(fieldErrs)
      if (first2) requestAnimationFrame(() => focusField(first2))
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

  // Both tests run against what is saved, so they wait for a save.
  const testBlockedReason = readOnly
    ? 'Testing needs edit access to API Settings.'
    : !config?.saved
      ? 'Save the settings first.'
      : dirty
        ? 'Save or cancel your changes first — tests use the saved settings.'
        : ''

  const runTest = async (kind) => {
    if (testBlockedReason || testing) return
    let recipient
    if (kind === 'email') {
      const message = testRecipientError(form.testRecipient, { required: true })
      setTestRecipientMessage(message)
      if (message) {
        requestAnimationFrame(() => document.getElementById(fieldId('testRecipient'))?.focus())
        return
      }
      recipient = form.testRecipient.trim()
    }

    setTesting(kind)
    setTestResult(null)
    try {
      const res = kind === 'email'
        ? await emailSettingsService.sendTestEmail(recipient)
        : await emailSettingsService.testConnection()
      setConfig(res.data.config)
      setTestResult({ kind, ...res.data.result })
    } catch (err) {
      if (kind === 'email') setTestRecipientMessage(serverFieldErrors(err).recipient || '')
      setTestResult({ kind, ok: false, message: requestErrorMessage(err, 'The test could not be run.') })
    } finally {
      setTesting('')
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

  const smtpInUse = usesSmtp(form.authMethod)
  const oauthInUse = usesOAuth(form.authMethod)
  const fixedEndpoint = !provider?.smtp.editable
  const additionalCount = form.additionalRecipients.length
  const status = connectionStatus(config)
  const secretInfo = config?.clientSecret
  const busy = saving || !!testing

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} component="h1">Email Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose the Microsoft mailbox the CMS sends notifications from, and who receives them
        </Typography>
      </Box>

      {readOnly && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have read-only access to email settings. Changes and tests need edit access — ask a Super Admin.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box component="form" noValidate onSubmit={handleSave} aria-label="Email settings">
            <Stack spacing={3}>
              {/* ── Provider and sender ─────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={Email}>Provider and sender</SectionTitle>
                <Stack spacing={2.5}>
                  <FormControl error={!!errorFor('provider')} disabled={readOnly || saving}>
                    <FormLabel id="email-provider-label" sx={{ mb: 1 }}>Email provider</FormLabel>
                    <RadioGroup
                      id={fieldId('provider')}
                      aria-labelledby="email-provider-label"
                      name="provider"
                      value={form.provider}
                      onChange={handleProviderChange}
                    >
                      {PROVIDER_KEYS.map((key) => {
                        const available = isProviderAvailable(key)
                        return (
                          <FormControlLabel
                            key={key}
                            value={key}
                            // Not offered until its sign-in and sending are built; the
                            // server refuses it as well.
                            disabled={!available && form.provider !== key}
                            control={<Radio />}
                            sx={{ alignItems: 'flex-start', mb: 1, mr: 0, '& .MuiRadio-root': { mt: -0.75 } }}
                            label={(
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                  <Typography variant="body2" fontWeight={600}>{PROVIDERS[key].label}</Typography>
                                  {!available && <Chip size="small" variant="outlined" label="Not available yet" />}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">{PROVIDERS[key].description}</Typography>
                              </Box>
                            )}
                          />
                        )
                      })}
                    </RadioGroup>
                    {errorFor('provider') && <FormHelperText>{errorFor('provider')}</FormHelperText>}
                  </FormControl>

                  {provider && <Alert severity="info" sx={{ py: 0 }}>{provider.note}</Alert>}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Sender name"
                      {...fieldProps('senderName')}
                      placeholder="Surjit Finance"
                      helperText={errorFor('senderName') || 'Optional. Shown as the "From" name.'}
                    />
                    <TextField
                      label="Sender email"
                      type="email"
                      required
                      autoComplete="off"
                      {...fieldProps('senderEmail')}
                      helperText={errorFor('senderEmail') || 'A licensed Microsoft 365 mailbox in your tenant.'}
                    />
                  </Stack>

                  <TextField
                    select
                    label="Authentication method"
                    required
                    {...fieldProps('authMethod')}
                    sx={selectSx}
                    helperText={errorFor('authMethod') || 'How the CMS signs in to send mail.'}
                  >
                    {(provider?.authMethods || []).map((m) => {
                      const available = isSupported(form.provider, m)
                      return (
                        <MenuItem key={m} value={m} disabled={!available}>
                          {AUTH_METHOD_LABELS[m]}{available ? '' : ' — not available yet'}
                        </MenuItem>
                      )
                    })}
                  </TextField>
                </Stack>
              </Paper>

              {/* ── SMTP ────────────────────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={Dns}>SMTP</SectionTitle>
                {!smtpInUse ? (
                  <Typography variant="body2" color="text.secondary">
                    Not used: {AUTH_METHOD_LABELS[form.authMethod]} sends through Microsoft Graph, not SMTP.
                  </Typography>
                ) : (
                  <Stack spacing={2.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="SMTP host"
                        required
                        {...fieldProps('smtpHost')}
                        placeholder="mail.example.com"
                        helperText={errorFor('smtpHost') || (fixedEndpoint ? 'Set by Microsoft for this provider.' : 'From your Exchange administrator.')}
                        slotProps={{ input: { readOnly: fixedEndpoint }, htmlInput: { spellCheck: false } }}
                        sx={{ flex: 2 }}
                      />
                      <TextField
                        label="Port"
                        required
                        {...fieldProps('smtpPort')}
                        helperText={errorFor('smtpPort') || (form.encryption === ENCRYPTION.SSL ? 'Usually 465 for SSL/TLS.' : 'Usually 587 for STARTTLS.')}
                        slotProps={{ input: { readOnly: fixedEndpoint }, htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 5 } }}
                        sx={{ flex: 1 }}
                      />
                    </Stack>

                    {fixedEndpoint ? (
                      <TextField
                        label="Encryption"
                        id={fieldId('encryption')}
                        value={ENCRYPTION_LABELS[form.encryption]}
                        disabled={readOnly}
                        fullWidth
                        helperText="Set by Microsoft for this provider."
                        slotProps={{ input: { readOnly: true } }}
                      />
                    ) : (
                      <TextField
                        select
                        label="Encryption"
                        required
                        {...fieldProps('encryption')}
                        sx={selectSx}
                        helperText={errorFor('encryption') || 'Unencrypted connections are not offered.'}
                      >
                        {Object.values(ENCRYPTION).map((v) => (
                          <MenuItem key={v} value={v}>{ENCRYPTION_LABELS[v]}</MenuItem>
                        ))}
                      </TextField>
                    )}

                    <TextField
                      label="SMTP username"
                      required
                      autoComplete="off"
                      {...fieldProps('smtpUsername')}
                      helperText={errorFor('smtpUsername') || 'Usually the sender mailbox address.'}
                      slotProps={{ htmlInput: { spellCheck: false } }}
                    />

                    {form.authMethod === AUTH_METHODS.SMTP_BASIC && (
                      <StatusRow label="SMTP password">
                        <Typography variant="body2">Not available yet</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Username-and-password sending is not supported yet, so no password can be saved.
                        </Typography>
                      </StatusRow>
                    )}
                  </Stack>
                )}
              </Paper>

              {/* ── Microsoft OAuth / Graph ─────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={Key}>Microsoft OAuth 2.0 / Graph</SectionTitle>
                {!oauthInUse ? (
                  <Typography variant="body2" color="text.secondary">
                    Not used: {AUTH_METHOD_LABELS[form.authMethod]} does not sign in through Microsoft Entra.
                  </Typography>
                ) : (
                  <Stack spacing={2.5}>
                    <Typography variant="body2" color="text.secondary">
                      From the app registration in Microsoft Entra ID. {oauthPermissionHint(form.provider, form.authMethod)} An administrator must grant consent.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="Directory (tenant) ID"
                        required
                        {...fieldProps('tenantId')}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        helperText={errorFor('tenantId') || (provider?.fixedTenantId ? 'Personal accounts always use "consumers".' : 'A tenant ID, or a domain such as contoso.onmicrosoft.com.')}
                        slotProps={{ input: { readOnly: !!provider?.fixedTenantId }, htmlInput: { spellCheck: false } }}
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
                      type="password"
                      required={!secretStored}
                      autoComplete="new-password"
                      {...fieldProps('clientSecret')}
                      placeholder={secretStored ? `Stored, ends in ${secretInfo.hint} — leave blank to keep it` : 'The secret Value from Certificates & secrets'}
                      helperText={errorFor('clientSecret') || (secretInfo?.configured && !secretInfo.readable
                        ? 'The stored secret can no longer be read by the server. Enter it again.'
                        : 'Stored encrypted on the server. It is never shown again after saving.')}
                      slotProps={{ htmlInput: { spellCheck: false, 'data-lpignore': 'true' } }}
                    />
                  </Stack>
                )}
              </Paper>

              {/* ── Recipients ──────────────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <SectionTitle icon={People} id="email-recipients-title">Notification recipients</SectionTitle>
                <Stack spacing={2.5}>
                  <TextField
                    label="Primary recipient"
                    type="email"
                    required
                    autoComplete="off"
                    {...fieldProps('primaryRecipient')}
                    helperText={errorFor('primaryRecipient') || 'Receives every notification.'}
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
                      Saved with these settings. Loan application emails are not sent yet — they will use this choice once connected.
                    </Typography>
                  </Box>

                  <Divider />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                    <TextField
                      label="Test email recipient"
                      type="email"
                      autoComplete="off"
                      id={fieldId('testRecipient')}
                      value={form.testRecipient}
                      onChange={(e) => { setForm((f) => ({ ...f, testRecipient: e.target.value })); setTestRecipientMessage('') }}
                      onKeyDown={(e) => {
                        // Enter sends the test rather than saving the form.
                        if (e.key === 'Enter') { e.preventDefault(); runTest('email') }
                      }}
                      error={!!testRecipientMessage}
                      helperText={testRecipientMessage || 'Receives one fixed test message from the saved sender mailbox.'}
                      disabled={readOnly || busy}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      startIcon={testing === 'email' ? <CircularProgress size={16} /> : <Send />}
                      onClick={() => runTest('email')}
                      disabled={!!testBlockedReason || busy}
                      aria-describedby={testBlockedReason ? 'email-test-reason' : undefined}
                      sx={{ flexShrink: 0, height: 56 }}
                    >
                      {testing === 'email' ? 'Sending…' : 'Send Test Email'}
                    </Button>
                  </Stack>
                  {testBlockedReason && (
                    <Typography variant="caption" color="text.secondary" id="email-test-reason" sx={{ mt: -1.5 }}>
                      {testBlockedReason}
                    </Typography>
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
            <Typography variant="subtitle1" fontWeight={600} component="h2" sx={{ mb: 1 }}>Connection status</Typography>
            <StatusRow label="Status">
              <Chip size="small" color={status.color} label={status.label} />
            </StatusRow>
            <StatusRow label="Saved settings">
              {config?.saved ? (
                <Stack spacing={0.25}>
                  <Typography variant="body2">{PROVIDERS[config.settings.provider]?.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {AUTH_METHOD_LABELS[config.settings.authMethod]} · updated {formatDateTime(config.updatedAt)}
                  </Typography>
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">None</Typography>}
            </StatusRow>
            <StatusRow label="Client secret">
              <Typography variant="body2" sx={{ fontFamily: secretInfo?.configured ? 'monospace' : undefined }} color={secretInfo?.configured ? 'text.primary' : 'text.secondary'}>
                {!secretInfo?.configured ? 'Not stored' : secretInfo.readable ? `••••••••${secretInfo.hint}` : 'Unreadable — enter it again'}
              </Typography>
            </StatusRow>
            {config?.saved && !config.configured && (
              <StatusRow label="Missing">
                <Stack component="ul" sx={{ m: 0, pl: 2 }} spacing={0.25}>
                  {config.missing.map((m) => <Typography key={m} component="li" variant="body2">{m}</Typography>)}
                </Stack>
              </StatusRow>
            )}
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
              ) : <Typography variant="body2" color="text.secondary">Not tested since the settings were saved</Typography>}
            </StatusRow>

            {testResult && (
              <Alert severity={testResult.ok ? 'success' : 'error'} role="alert" sx={{ mt: 1 }}>
                {testResult.message}
              </Alert>
            )}

            <Button
              variant="outlined"
              fullWidth
              startIcon={testing === 'connection' ? <CircularProgress size={16} /> : <NetworkCheck />}
              onClick={() => runTest('connection')}
              disabled={!!testBlockedReason || busy}
              aria-describedby="email-connection-reason"
              sx={{ mt: 2 }}
            >
              {testing === 'connection' ? 'Testing…' : 'Test Connection'}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" id="email-connection-reason" sx={{ mt: 1 }}>
              {testBlockedReason || 'Signs in to Microsoft with the saved app credentials and checks the Mail.Send permission. Nothing is sent.'}
            </Typography>
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
