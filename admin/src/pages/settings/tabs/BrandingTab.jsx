import { Box, Grid, Typography, Button, Avatar, Stack, CircularProgress } from '@mui/material'
import { CloudUpload, Save, BrandingWatermark } from '@mui/icons-material'

const LogoField = ({ label, preview, onChange, fieldName }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 500 }}>
      {label}
    </Typography>
    <Stack direction="row" spacing={2} alignItems="center">
      <Avatar
        src={preview || ''}
        variant="rounded"
        sx={{ width: 80, height: 80, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }}
      >
        {!preview && <BrandingWatermark color="disabled" />}
      </Avatar>
      <Button
        component="label"
        variant="outlined"
        size="small"
        startIcon={<CloudUpload />}
      >
        {preview ? 'Change' : 'Upload'}
        <input type="file" hidden accept="image/*" onChange={onChange} data-field={fieldName} />
      </Button>
    </Stack>
  </Box>
)

const BrandingTab = ({ previews, onFileChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 760 }}>
      <Grid container spacing={4}>
        <Grid item xs={12} sm={6}>
          <LogoField
            label="Primary Logo"
            preview={previews.primaryLogo}
            onChange={onFileChange('primaryLogo')}
            fieldName="primaryLogo"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <LogoField
            label="White Logo"
            preview={previews.whiteLogo}
            onChange={onFileChange('whiteLogo')}
            fieldName="whiteLogo"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <LogoField
            label="Mobile Logo"
            preview={previews.mobileLogo}
            onChange={onFileChange('mobileLogo')}
            fieldName="mobileLogo"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <LogoField
            label="Favicon"
            preview={previews.favicon}
            onChange={onFileChange('favicon')}
            fieldName="favicon"
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Branding'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default BrandingTab
