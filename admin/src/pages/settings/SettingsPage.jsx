import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Paper, Tabs, Tab, CircularProgress
} from '@mui/material'
import { settingsService } from '../../services/settings.service'
import Toast from '../../components/Toast'
import CompanyTab from './tabs/CompanyTab'
import BrandingTab from './tabs/BrandingTab'
import ContactTab from './tabs/ContactTab'
import AddressTab from './tabs/AddressTab'
import SocialTab from './tabs/SocialTab'
import HeaderTab from './tabs/HeaderTab'
import FooterTab from './tabs/FooterTab'
import BusinessHoursTab from './tabs/BusinessHoursTab'

const TAB_LABELS = [
  'Company', 'Branding', 'Contact', 'Address',
  'Social Media', 'Header', 'Footer', 'Business Hours'
]

const LOGO_FIELDS = ['primaryLogo', 'whiteLogo', 'mobileLogo', 'favicon']

const DEFAULT_FORM = {
  companyName: '', tagline: '', companyDescription: '',
  phone: '', alternatePhone: '', tollFreeNumber: '', email: '', supportEmail: '', whatsappNumber: '',
  officeAddress: '', city: '', state: '', country: '', pinCode: '', googleMapsUrl: '',
  facebook: '', instagram: '', linkedin: '', youtube: '', twitter: '',
  headerPrimaryButtonText: '', headerPrimaryButtonUrl: '',
  headerSecondaryButtonText: '', headerSecondaryButtonUrl: '',
  footerDescription: '', copyright: '', footerNote: '',
  businessHours: {
    monday: '', tuesday: '', wednesday: '', thursday: '',
    friday: '', saturday: '', sunday: ''
  }
}

const DEFAULT_PREVIEWS = { primaryLogo: '', whiteLogo: '', mobileLogo: '', favicon: '' }
const DEFAULT_FILES = { primaryLogo: null, whiteLogo: null, mobileLogo: null, favicon: null }

// Fields included in each tab's save call
const TAB_FIELDS = {
  0: ['companyName', 'tagline', 'companyDescription'],
  1: LOGO_FIELDS,
  2: ['phone', 'alternatePhone', 'tollFreeNumber', 'email', 'supportEmail', 'whatsappNumber'],
  3: ['officeAddress', 'city', 'state', 'country', 'pinCode', 'googleMapsUrl'],
  4: ['facebook', 'instagram', 'linkedin', 'youtube', 'twitter'],
  5: ['headerPrimaryButtonText', 'headerPrimaryButtonUrl', 'headerSecondaryButtonText', 'headerSecondaryButtonUrl'],
  6: ['footerDescription', 'copyright', 'footerNote'],
  7: ['businessHours']
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [previews, setPreviews] = useState(DEFAULT_PREVIEWS)
  const [files, setFiles] = useState(DEFAULT_FILES)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchSettings = useCallback(async () => {
    try {
      const res = await settingsService.getSettings()
      const s = res.data.settings

      setForm({
        companyName: s.companyName || '',
        tagline: s.tagline || '',
        companyDescription: s.companyDescription || '',
        phone: s.phone || '',
        alternatePhone: s.alternatePhone || '',
        tollFreeNumber: s.tollFreeNumber || '',
        email: s.email || '',
        supportEmail: s.supportEmail || '',
        whatsappNumber: s.whatsappNumber || '',
        officeAddress: s.officeAddress || '',
        city: s.city || '',
        state: s.state || '',
        country: s.country || '',
        pinCode: s.pinCode || '',
        googleMapsUrl: s.googleMapsUrl || '',
        facebook: s.facebook || '',
        instagram: s.instagram || '',
        linkedin: s.linkedin || '',
        youtube: s.youtube || '',
        twitter: s.twitter || '',
        headerPrimaryButtonText: s.headerPrimaryButtonText || '',
        headerPrimaryButtonUrl: s.headerPrimaryButtonUrl || '',
        headerSecondaryButtonText: s.headerSecondaryButtonText || '',
        headerSecondaryButtonUrl: s.headerSecondaryButtonUrl || '',
        footerDescription: s.footerDescription || '',
        copyright: s.copyright || '',
        footerNote: s.footerNote || '',
        businessHours: {
          monday: s.businessHours?.monday || '',
          tuesday: s.businessHours?.tuesday || '',
          wednesday: s.businessHours?.wednesday || '',
          thursday: s.businessHours?.thursday || '',
          friday: s.businessHours?.friday || '',
          saturday: s.businessHours?.saturday || '',
          sunday: s.businessHours?.sunday || ''
        }
      })
      setPreviews({
        primaryLogo: s.primaryLogo?.url || '',
        whiteLogo: s.whiteLogo?.url || '',
        mobileLogo: s.mobileLogo?.url || '',
        favicon: s.favicon?.url || ''
      })
    } catch {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.startsWith('businessHours.')) {
      const day = name.replace('businessHours.', '')
      setForm((prev) => ({ ...prev, businessHours: { ...prev.businessHours, [day]: value } }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleFileChange = (field) => (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFiles((prev) => ({ ...prev, [field]: file }))
    setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      const fields = TAB_FIELDS[activeTab]

      fields.forEach((field) => {
        if (field === 'businessHours') {
          fd.append('businessHours', JSON.stringify(form.businessHours))
        } else if (LOGO_FIELDS.includes(field)) {
          if (files[field]) fd.append(field, files[field])
        } else {
          fd.append(field, form[field] ?? '')
        }
      })

      await settingsService.updateSettings(fd)
      showToast('Settings saved successfully')

      // Clear pending logo files for branding tab
      if (activeTab === 1) {
        setFiles(DEFAULT_FILES)
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Global Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage site-wide content and configuration. Each tab saves independently.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': { minWidth: 90, fontWeight: 500 }
          }}
        >
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <CompanyTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 1 && (
            <BrandingTab previews={previews} onFileChange={handleFileChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 2 && (
            <ContactTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 3 && (
            <AddressTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 4 && (
            <SocialTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 5 && (
            <HeaderTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 6 && (
            <FooterTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
          {activeTab === 7 && (
            <BusinessHoursTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
          )}
        </Box>
      </Paper>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default SettingsPage
