import { Box, Grid, TextField, Button, CircularProgress } from '@mui/material'
import { Save } from '@mui/icons-material'

const FooterTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 760 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            label="Footer Description"
            name="footerDescription"
            value={form.footerDescription}
            onChange={onChange}
            fullWidth
            multiline
            rows={4}
            size="small"
            inputProps={{ maxLength: 1000 }}
            helperText={`${(form.footerDescription || '').length}/1000`}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Copyright Text"
            name="copyright"
            value={form.copyright}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 300 }}
            placeholder="© 2025 Surjit Finance. All rights reserved."
            helperText={`${(form.copyright || '').length}/300`}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Footer Note"
            name="footerNote"
            value={form.footerNote}
            onChange={onChange}
            fullWidth
            multiline
            rows={2}
            size="small"
            inputProps={{ maxLength: 500 }}
            helperText={`${(form.footerNote || '').length}/500`}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Footer'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default FooterTab
