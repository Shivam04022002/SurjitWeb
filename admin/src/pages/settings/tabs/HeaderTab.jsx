import { Box, Grid, TextField, Button, CircularProgress, Divider, Typography } from '@mui/material'
import { Save } from '@mui/icons-material'

const HeaderTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Primary Button
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Primary Button Text"
            name="headerPrimaryButtonText"
            value={form.headerPrimaryButtonText}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
            placeholder="e.g. Apply Now"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Primary Button URL"
            name="headerPrimaryButtonUrl"
            value={form.headerPrimaryButtonUrl}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://..."
          />
        </Grid>

        <Grid item xs={12}>
          <Divider />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>
            Secondary Button
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Secondary Button Text"
            name="headerSecondaryButtonText"
            value={form.headerSecondaryButtonText}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
            placeholder="e.g. Contact Us"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Secondary Button URL"
            name="headerSecondaryButtonUrl"
            value={form.headerSecondaryButtonUrl}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://..."
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Header'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default HeaderTab
