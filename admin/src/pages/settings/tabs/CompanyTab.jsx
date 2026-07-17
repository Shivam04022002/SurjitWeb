import { Box, TextField, Stack, Button, CircularProgress, Typography } from '@mui/material'
import { Save } from '@mui/icons-material'

const CompanyTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Stack spacing={3}>
        <TextField
          label="Company Name"
          name="companyName"
          value={form.companyName}
          onChange={onChange}
          fullWidth
          size="small"
          inputProps={{ maxLength: 200 }}
          helperText={`${(form.companyName || '').length}/200`}
        />
        <TextField
          label="Tagline"
          name="tagline"
          value={form.tagline}
          onChange={onChange}
          fullWidth
          size="small"
          inputProps={{ maxLength: 500 }}
          helperText={`${(form.tagline || '').length}/500`}
        />
        <TextField
          label="Company Description"
          name="companyDescription"
          value={form.companyDescription}
          onChange={onChange}
          fullWidth
          multiline
          rows={5}
          size="small"
        />
        <Box>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Company'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

export default CompanyTab
