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
  const { isSuperAdmin } = usePermissions()
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
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => setToast({ open: true, message, severity }), [])

  const applyConfig = (c) => {
    setConfig(c)
    setTextModel(c.textModel || '')
    setImageModel(c.imageModel || '')
    setImageEnabled(c.imageGenerationEnabled !== false)
  }

  useEffect(() => {
    // Other roles see the no-permission view, which renders before loading.
    if (!isSuperAdmin) return
    geminiService.getConfig()
      .then((res) => applyConfig(res.data.config))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load the API configuration.'))
      .finally(() => setLoading(false))
  }, [isSuperAdmin])

  const fieldErrors = (err) => Object.fromEntries((err?.response?.data?.errors || []).map((e) => [e.field, e.message]))

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const payload = { textModel: textModel.trim(), imageModel: imageModel.trim(), imageGenerationEnabled: imageEnabled }
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

  if (!isSuperAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>API</Typography>
        <Alert severity="info">Only a Super Admin can view or change API keys.</Alert>
      </Container>
    )
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
          Connect Google Gemini to generate blog drafts under Gemini Blogs
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
                  helperText={errors.textModel || `Default: ${config?.defaults?.textModel || 'gemini-2.5-flash'}`}
                />
                <TextField
                  label="Image model" fullWidth value={imageModel}
                  onChange={(e) => { setImageModel(e.target.value); setErrors((x) => ({ ...x, imageModel: '' })) }}
                  disabled={!imageEnabled}
                  error={!!errors.imageModel}
                  helperText={errors.imageModel || `Default: ${config?.defaults?.imageModel || 'gemini-2.5-flash-image'}`}
                />
              </Stack>

              <FormControlLabel
                control={<Switch checked={imageEnabled} onChange={(e) => setImageEnabled(e.target.checked)} />}
                label="Generate featured images with Gemini"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                When off, or when the image model cannot generate images, admins upload the featured image themselves.
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
            <StatusRow label="Featured images">
              <Typography variant="body2">
                {config?.imageGenerationEnabled ? `Generated with ${config.imageModel}` : 'Uploaded manually'}
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
