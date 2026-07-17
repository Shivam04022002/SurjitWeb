import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { aboutService } from '../../services/about.service'
import ImageUpload from '../../components/ImageUpload'
import Toast from '../../components/Toast'

const CompanyInfoPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [heroImageFile, setHeroImageFile] = useState(null)
  const [aboutImageFile, setAboutImageFile] = useState(null)
  const [currentHeroImage, setCurrentHeroImage] = useState('')
  const [currentAboutImage, setCurrentAboutImage] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      companyName: '',
      tagline: '',
      aboutDescription: '',
      mission: '',
      vision: '',
      history: '',
      heroTitle: '',
      heroSubtitle: ''
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await aboutService.getCompanyInfo()
        const c = res.data.company
        reset({
          companyName: c.companyName || '',
          tagline: c.tagline || '',
          aboutDescription: c.aboutDescription || '',
          mission: c.mission || '',
          vision: c.vision || '',
          history: c.history || '',
          heroTitle: c.heroTitle || '',
          heroSubtitle: c.heroSubtitle || ''
        })
        setCurrentHeroImage(c.heroImage?.url || '')
        setCurrentAboutImage(c.aboutImage?.url || '')
      } catch (err) {
        showToast('Failed to load company information', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [reset])

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, val)
      })
      if (heroImageFile) formData.append('heroImage', heroImageFile)
      if (aboutImageFile) formData.append('aboutImage', aboutImageFile)

      const res = await aboutService.updateCompanyInfo(formData)
      const c = res.data.company
      setCurrentHeroImage(c.heroImage?.url || '')
      setCurrentAboutImage(c.aboutImage?.url || '')
      setHeroImageFile(null)
      setAboutImageFile(null)
      showToast('Company information saved successfully')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save company information', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" disableGutters>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700}>
          Company Information
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="companyName"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Company Name" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="tagline"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Tagline" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="aboutDescription"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="About Description"
                          fullWidth
                          multiline
                          rows={5}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Mission & Vision */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Mission
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Controller
                  name="mission"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Mission Statement" fullWidth multiline rows={6} />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Vision
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Controller
                  name="vision"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Vision Statement" fullWidth multiline rows={6} />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* History */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Company History
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Controller
                  name="history"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="History" fullWidth multiline rows={5} />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Hero Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Hero Section
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="heroTitle"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Hero Title" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="heroSubtitle"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Hero Subtitle" fullWidth />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <ImageUpload
                      label="Hero Image"
                      currentImageUrl={currentHeroImage}
                      onChange={setHeroImageFile}
                      name="heroImage"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <ImageUpload
                      label="About Image"
                      currentImageUrl={currentAboutImage}
                      onChange={setAboutImageFile}
                      name="aboutImage"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default CompanyInfoPage
