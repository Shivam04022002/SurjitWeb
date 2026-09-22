import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Stack, TextField, Button, Chip, Alert, Divider,
  IconButton, InputAdornment, CircularProgress, Grid, Link
} from '@mui/material'
import {
  Visibility, VisibilityOff, Save, NetworkCheck, DeleteOutline, CheckCircle, ErrorOutline, Image as ImageIcon
} from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import ConfirmDialog from '../../components/ConfirmDialog'

const SOURCE_LABELS = {
  database: 'Stored encrypted in the CMS',
  environment: 'Server environment (PEXELS_API_KEY)',
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

// The Pexels key, managed like the Gemini key: typed once, stored encrypted
// on the server, shown afterwards only by its last four characters.
// `onChanged` lets the page refresh what depends on it (featured images).
const PexelsSettingsCard = ({ showToast, onChanged }) => {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Held only in this input until submitted, then cleared.
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => geminiService.getPexelsConfig()
    .then((res) => setConfig(res.data.config))
    .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load the Pexels configuration.'))
    .finally(() => setLoading(false)), [])

  useEffect(() => { load() }, [load])

  const fieldError = (err) => (err?.response?.data?.errors || []).find((e) => e.field === 'apiKey')?.message || ''

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await geminiService.savePexelsKey(apiKey.trim())
      setConfig(res.data.config)
      setApiKey('')
      setShowKey(false)
      setTestResult(null)
      showToast('Pexels API key saved securely')
      onChanged?.()
    } catch (err) {
      setError(fieldError(err))
      showToast(err?.response?.data?.message || 'Could not save the Pexels key', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await geminiService.testPexelsConnection(apiKey.trim() || undefined)
      setTestResult(res.data.result)
      if (!res.data.result.candidate) await load()
    } catch (err) {
      setError(fieldError(err))
      setTestResult({ ok: false, message: err?.response?.data?.message || 'The connection test could not be run.' })
    } finally {
      setTesting(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const res = await geminiService.removePexelsKey()
      setConfig(res.data.config)
      setTestResult(null)
      showToast('Pexels API key removed')
      onChanged?.()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not remove the Pexels key', 'error')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const hasStoredKey = config?.source === 'database'
  const statusChip = !config ? null : config.configured
    ? <Chip size="small" color="success" icon={<CheckCircle />} label="Configured" />
    : !config.keyReadable
      ? <Chip size="small" color="error" icon={<ErrorOutline />} label="Key unreadable — re-enter it" />
      : <Chip size="small" label="Not configured" />

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <ImageIcon color="action" />
        <Typography variant="subtitle1" fontWeight={600}>Pexels API</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Optional fallback: if the AI featured image cannot be generated, a free Pexels stock photo (credited to the photographer, with the Surjit Finance logo added) is used instead.
        Get a free key at <Link href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer">pexels.com/api</Link>.
        Without a key, an AI image that fails simply means the admin uploads one.
      </Typography>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2.5}>
              {config?.source === 'environment' && (
                <Alert severity="info">
                  The server environment key (PEXELS_API_KEY) is in use. A key saved here replaces it.
                </Alert>
              )}
              <TextField
                label={hasStoredKey ? 'Update Pexels API Key' : 'Pexels API Key'}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError('') }}
                fullWidth
                autoComplete="new-password"
                placeholder={hasStoredKey ? `Current key ends in ${config.keyHint}` : 'Paste the complete Pexels key'}
                error={!!error}
                helperText={error || 'Stored encrypted on the server. It is never shown again after saving.'}
                slotProps={{
                  htmlInput: { spellCheck: false, 'data-lpignore': 'true' },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showKey ? 'Hide Pexels API key' : 'Show Pexels API key'}
                          onClick={() => setShowKey((s) => !s)}
                          edge="end"
                          disabled={!apiKey}
                        >
                          {showKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />

              {testResult && (
                <Alert severity={testResult.ok ? 'success' : testResult.configured === false ? 'info' : 'error'}>
                  {testResult.candidate && 'Unsaved key: '}{testResult.message}
                </Alert>
              )}

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleSave}
                  disabled={saving || testing || !apiKey.trim()}
                >
                  {hasStoredKey ? 'Update Key' : 'Save Key'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={testing ? <CircularProgress size={16} /> : <NetworkCheck />}
                  onClick={handleTest}
                  disabled={testing || saving}
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
          </Grid>

          <Grid item xs={12} md={5}>
            <StatusRow label="Status">{statusChip}</StatusRow>
            <StatusRow label="Key source">
              <Typography variant="body2">{SOURCE_LABELS[config?.source] || '—'}</Typography>
            </StatusRow>
            <StatusRow label="API key">
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {config?.keyHint ? `••••••••${config.keyHint}` : '—'}
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
                    label={config.lastTest.ok ? 'Connected' : 'Failed'}
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
          </Grid>
        </Grid>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove Pexels API key"
        message={config?.environmentKey
          ? 'The server environment key (PEXELS_API_KEY) will be used instead. Continue?'
          : 'Automatic featured images will stop; admins will upload images themselves. Continue?'}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        loading={removing}
      />
    </Paper>
  )
}

export default PexelsSettingsCard
