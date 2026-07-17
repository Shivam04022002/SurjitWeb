import { Box, Grid, TextField, Button, CircularProgress, InputAdornment } from '@mui/material'
import { Save, Facebook, Instagram, LinkedIn, YouTube, Twitter } from '@mui/icons-material'

const SocialTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            label="Facebook"
            name="facebook"
            value={form.facebook}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://facebook.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Facebook sx={{ color: '#1877f2' }} fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Instagram"
            name="instagram"
            value={form.instagram}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://instagram.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Instagram sx={{ color: '#e1306c' }} fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="LinkedIn"
            name="linkedin"
            value={form.linkedin}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://linkedin.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LinkedIn sx={{ color: '#0a66c2' }} fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="YouTube"
            name="youtube"
            value={form.youtube}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://youtube.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <YouTube sx={{ color: '#ff0000' }} fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="X (Twitter)"
            name="twitter"
            value={form.twitter}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://x.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Twitter sx={{ color: '#1da1f2' }} fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Social Media'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default SocialTab
