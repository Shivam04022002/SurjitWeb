import { Box, Grid, TextField, Button, CircularProgress } from '@mui/material'
import { Save } from '@mui/icons-material'

const ContactTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 760 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Phone Number"
            name="phone"
            value={form.phone}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 20 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Alternate Phone"
            name="alternatePhone"
            value={form.alternatePhone}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 20 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Toll Free Number"
            name="tollFreeNumber"
            value={form.tollFreeNumber}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 20 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="WhatsApp Number"
            name="whatsappNumber"
            value={form.whatsappNumber}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 20 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Support Email"
            name="supportEmail"
            type="email"
            value={form.supportEmail}
            onChange={onChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Contact'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ContactTab
