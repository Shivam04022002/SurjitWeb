import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Paper, Stack, TextField, Button, Chip, Alert, Divider,
  IconButton, InputAdornment, FormControlLabel, Switch, CircularProgress, Grid
} from '@mui/material'
import {
  Visibility, VisibilityOff, Save, NetworkCheck, DeleteOutline, CheckCircle, ErrorOutline, Key
} from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import { usePermissions } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'
import PexelsSettingsCard from './PexelsSettingsCard'
import { parseModelList, formatModelList } from './modelList'

const FALLBACK_SOURCE_LABELS = {
  saved: 'Saved on this page',
  environment: 'Server environment (GEMINI_FALLBACK_TEXT_MODELS)'
}

const SOURCE_LABELS = {
  environment: 'Server environment (GEMINI_API_KEY)',
  database: 'Stored encrypted in the CMS',
  none: 'Not configured'
}

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

const StatusRow = ({ label, children }) => (
  <Stack direction="row" spacing={2} sx={{ py: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 150, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
  </Stack>
)

const ApiSettingsPage = () => {
  const perms = usePermissions()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // The key lives only in this input until it is submitted, then it is
  // cleared. It is never written to storage or kept after saving.
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [textModel, setTextModel] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [imageEnabled, setImageEnabled] = useState(true)
  const [pexelsFallback, setPexelsFallback] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [errors, setErrors] = useState({})
  const [fallbackText, setFallbackText] = useState('')
  const [fallbackBusy, setFallbackBusy] = useState('')
  const [fallbackError, setFallbackError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => setToast({ open: true, message, severity }), [])

  const applyConfig = (c) => {
    setConfig(c)
    setTextModel(c.textModel || '')
    setImageModel(c.imageModel || '')
    setImageEnabled(c.imageGenerationEnabled !== false)
    setPexelsFallback(c.pexelsFallbackEnabled !== false)
    // Only a list saved here is editable; an environment list is shown in
    // the status panel, never copied into the field.
    setFallbackText(c.fallbackSource === 'saved' ? formatModelList(c.textFallbacks) : '')
    setFallbackError('')
  }

  useEffect(() => {
    // The route guard has already refused anyone without integrations.view, so
    // reaching here means the configuration may be read.
    geminiService.getConfig()
      .then((res) => applyConfig(res.data.config))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load the API configuration.'))
      .finally(() => setLoading(false))
  }, [])

  // The Pexels card changes whether featured images can be found automatically.
  const refreshConfig = useCallback(() => {
    geminiService.getConfig().then((res) => setConfig(res.data.config)).catch(() => {})
  }, [])

  const fieldErrors = (err) => Object.fromEntries((err?.response?.data?.errors || []).map((e) => [e.field, e.message]))

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        textModel: textModel.trim(),
        imageModel: imageModel.trim(),
        imageGenerationEnabled: imageEnabled,
        pexelsFallbackEnabled: pexelsFallback
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()
      const res = await geminiService.saveConfig(payload)
      applyConfig(res.data.config)
      setApiKey('')
      setShowKey(false)
      setTestResult(null)
      showToast(payload.apiKey ? 'API key saved securely' : 'Configuration updated')
    } catch (err) {
      setErrors(fieldErrors(err))
      showToast(err?.response?.data?.message || 'Could not save the configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await geminiService.testConnection(apiKey.trim() || undefined)
      setTestResult(res.data.result)
      if (!res.data.result.candidate) {
        const refreshed = await geminiService.getConfig()
        setConfig(refreshed.data.config)
      }
    } catch (err) {
      setErrors(fieldErrors(err))
      setTestResult({ ok: false, message: err?.response?.data?.message || 'The connection test could not be run.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveFallbacks = async () => {
    setFallbackBusy('save')
    setFallbackError('')
    try {
      await geminiService.saveFallbacks(parseModelList(fallbackText))
      const refreshed = await geminiService.getConfig()
      applyConfig(refreshed.data.config)
      showToast('Free fallback models saved')
    } catch (err) {
      setFallbackError(err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || 'Could not save the fallback models')
    } finally {
      setFallbackBusy('')
    }
  }

  const handleClearFallbacks = async () => {
    setFallbackBusy('clear')
    setFallbackError('')
    try {
      await geminiService.clearFallbacks()
      const refreshed = await geminiService.getConfig()
      applyConfig(refreshed.data.config)
      showToast('Free fallback models cleared')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not clear the fallback models', 'error')
    } finally {
      setFallbackBusy('')
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const res = await geminiService.removeKey()
      applyConfig(res.data.config)
      setTestResult(null)
      showToast('Stored API key removed')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not remove the key', 'error')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  const fromEnv = config?.source === 'environment'
  const hasStoredKey = config?.source === 'database'
  const statusChip = !config ? null : config.configured
    ? <Chip size="small" color="success" icon={<CheckCircle />} label="Configured" />
    : config.source !== 'none' && !config.keyReadable
      ? <Chip size="small" color="error" icon={<ErrorOutline />} label="Key unreadable — re-enter it" />
      : <Chip size="small" label="Not configured" />

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>API</Typography>
        <Typography variant="body2" color="text.secondary">
          Connect Google Gemini to generate blog drafts and their featured images under Gemini Blogs, with Pexels as an optional image fallback
        </Typography>
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Key color="action" />
              <Typography variant="subtitle1" fontWeight={600}>Google Gemini</Typography>
            </Stack>

            <Stack spacing={2.5}>
              {fromEnv && (
                <Alert severity="info">
                  The API key is set in the server environment and takes precedence over this page.
                  Model settings below still apply.
                </Alert>
              )}

              <TextField
                label={hasStoredKey ? 'Replace API Key' : 'Google Gemini API Key'}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setErrors((x) => ({ ...x, apiKey: '' })) }}
                disabled={fromEnv}
                fullWidth
                autoComplete="new-password"
                placeholder={hasStoredKey ? `Current key ends in ${config.keyHint} — leave blank to keep it` : 'Paste the complete key (AIza… or AQ.…)'}
                error={!!errors.apiKey}
                helperText={errors.apiKey || 'Stored encrypted on the server. It is never shown again after saving.'}
                slotProps={{
                  htmlInput: { spellCheck: false, 'data-lpignore': 'true' },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showKey ? 'Hide API key' : 'Show API key'}
                          onClick={() => setShowKey((s) => !s)}
                          edge="end"
                          disabled={fromEnv || !apiKey}
                        >
                          {showKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Text model" fullWidth value={textModel}
                  onChange={(e) => { setTextModel(e.target.value); setErrors((x) => ({ ...x, textModel: '' })) }}
                  error={!!errors.textModel}
                  helperText={errors.textModel || `Default: ${config?.defaults?.textModel || 'gemini-3.6-flash'}`}
                />
                <TextField
                  label="Image model" fullWidth value={imageModel}
                  onChange={(e) => { setImageModel(e.target.value); setErrors((x) => ({ ...x, imageModel: '' })) }}
                  disabled={!imageEnabled}
                  error={!!errors.imageModel}
                  helperText={errors.imageModel || `Featured images only — separate from the text model. Default: ${config?.defaults?.imageModel || 'gemini-3.1-flash-image'} (Nano Banana 2).`}
                />
              </Stack>

              <Box>
                <TextField
                  label="Free fallback models"
                  fullWidth
                  value={fallbackText}
                  onChange={(e) => { setFallbackText(e.target.value); setFallbackError('') }}
                  placeholder="e.g. gemini-3.1-flash-lite, gemini-3.5-flash-lite"
                  error={!!fallbackError}
                  helperText={fallbackError || 'Optional. Used automatically when the primary text model hits quota or temporary availability errors. Only free text models are allowed. Separate names with commas.'}
                  slotProps={{ htmlInput: { spellCheck: false } }}
                />
                <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={fallbackBusy === 'save' ? <CircularProgress size={14} /> : <Save />}
                    onClick={handleSaveFallbacks}
                    disabled={!!fallbackBusy || !parseModelList(fallbackText).length}
                  >
                    Save Fallbacks
                  </Button>
                  {config?.fallbackSource === 'saved' && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={fallbackBusy === 'clear' ? <CircularProgress size={14} color="inherit" /> : <DeleteOutline />}
                      onClick={handleClearFallbacks}
                      disabled={!!fallbackBusy}
                    >
                      Clear Fallbacks
                    </Button>
                  )}
                </Stack>
              </Box>

              <FormControlLabel
                control={<Switch checked={imageEnabled} onChange={(e) => setImageEnabled(e.target.checked)} />}
                label="Generate featured images automatically (AI — Nano Banana 2)"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                Each blog gets an image made for its content, with the Surjit Finance logo added to the image. When off, admins upload the featured image themselves.
              </Typography>
              <Alert severity="info" sx={{ py: 0 }}>AI-generated featured images require Gemini API billing.</Alert>
              <FormControlLabel
                control={<Switch checked={pexelsFallback} onChange={(e) => setPexelsFallback(e.target.checked)} disabled={!imageEnabled} />}
                label="Use a Pexels photo if AI image generation fails"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                Needs a Pexels key (below). The photo also gets the logo and is labelled as a Pexels image in Review. Manual upload is always available.
              </Typography>

              {testResult && (
                <Alert severity={testResult.ok ? 'success' : 'error'}>
                  {testResult.candidate && 'Unsaved key: '}{testResult.message}
                </Alert>
              )}

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleSave}
                  disabled={saving || testing}
                >
                  {hasStoredKey || fromEnv ? 'Update' : 'Save'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={testing ? <CircularProgress size={16} /> : <NetworkCheck />}
                  onClick={handleTest}
                  disabled={testing || saving || (!apiKey.trim() && config?.source === 'none')}
                >
                  {testing ? 'Testing…' : apiKey.trim() ? 'Test This Key' : 'Test Connection'}
                </Button>
                {hasStoredKey && (
                  <Button color="error" startIcon={<DeleteOutline />} onClick={() => setConfirmRemove(true)} disabled={saving || testing}>
                    Remove Key
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Current configuration</Typography>
            <StatusRow label="Status">{statusChip}</StatusRow>
            <StatusRow label="Key source">
              <Typography variant="body2">{SOURCE_LABELS[config?.source] || '—'}</Typography>
            </StatusRow>
            <StatusRow label="API key">
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {config?.keyHint ? `••••••••••••${config.keyHint}` : '—'}
              </Typography>
            </StatusRow>
            <StatusRow label="Text model"><Typography variant="body2">{config?.textModel}</Typography></StatusRow>
            <StatusRow label="Free fallbacks">
              {config?.textFallbacks?.length ? (
                <Stack spacing={0.25}>
                  {config.textFallbacks.map((m) => (
                    <Typography key={m} variant="body2" sx={{ fontFamily: 'monospace' }}>{m}</Typography>
                  ))}
                  <Typography variant="caption" color="text.secondary">{FALLBACK_SOURCE_LABELS[config.fallbackSource]}</Typography>
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">None</Typography>}
            </StatusRow>
            <StatusRow label="Featured images">
              {!config?.imageGenerationEnabled
                ? <Typography variant="body2">Uploaded manually</Typography>
                : (
                  <Stack spacing={0.25}>
                    <Typography variant="body2">AI Generated — {config?.imageProvider?.displayName || config?.imageModel}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{config?.imageModel}</Typography>
                  </Stack>
                )}
            </StatusRow>
            <StatusRow label="Pexels fallback">
              <Typography variant="body2" color={config?.imageProvider?.pexelsFallback?.enabled ? 'text.primary' : 'text.secondary'}>
                {!config?.imageGenerationEnabled || !config?.imageProvider?.pexelsFallback?.enabled
                  ? 'Off'
                  : config.imageProvider.pexelsFallback.configured
                    ? 'On — used only if AI image generation fails'
                    : 'On, but no Pexels key — upload if AI image generation fails'}
              </Typography>
            </StatusRow>
            <Divider sx={{ my: 1 }} />
            <StatusRow label="Last test">
              {config?.lastTest ? (
                <Stack spacing={0.5}>
                  <Chip
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                    color={config.lastTest.ok ? 'success' : 'error'}
                    label={config.lastTest.ok ? 'Passed' : 'Failed'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(config.lastTest.at)} — {config.lastTest.message}
                  </Typography>
                </Stack>
              ) : <Typography variant="body2" color="text.secondary">Not tested yet</Typography>}
            </StatusRow>
            <StatusRow label="Last updated">
              <Typography variant="body2">{formatDateTime(config?.updatedAt)}</Typography>
            </StatusRow>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <PexelsSettingsCard showToast={showToast} onChanged={refreshConfig} />
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove API key"
        message="Blog generation will stop working until a new key is saved. Continue?"
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        loading={removing}
      />
      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default ApiSettingsPage
