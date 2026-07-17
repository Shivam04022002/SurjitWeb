import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Tabs, Tab, Paper, Button,
  CircularProgress, Breadcrumbs, Link, Chip
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { productsService } from '../../../services/products.service'
import Toast from '../../../components/Toast'
import GeneralTab from './GeneralTab'
import FeaturesTab from './FeaturesTab'
import SimpleListTab from './SimpleListTab'
import InterestRatesTab from './InterestRatesTab'
import FaqsTab from './FaqsTab'
import EmiTab from './EmiTab'
import SeoTab from './SeoTab'

const TAB_LABELS = [
  'General',
  'Features',
  'Eligibility',
  'Documents',
  'Interest Rates',
  'FAQs',
  'EMI',
  'SEO'
]

const ProductEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }, [])

  const fetchProduct = useCallback(async () => {
    try {
      const [productRes, catsRes] = await Promise.all([
        productsService.getProductById(id),
        productsService.getAllCategories()
      ])
      setProduct(productRes.data.product)
      setCategories(catsRes.data.categories)
    } catch {
      showToast('Failed to load product', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => { fetchProduct() }, [fetchProduct])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!product) {
    return (
      <Container maxWidth="xl" disableGutters>
        <Typography color="error">Product not found.</Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/products')} sx={{ mt: 2 }}>
          Back to Products
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link
            component="button"
            variant="body2"
            underline="hover"
            color="inherit"
            onClick={() => navigate('/products')}
          >
            Products
          </Link>
          <Typography variant="body2" color="text.primary">{product.name}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/products')}
              variant="outlined"
              size="small"
            >
              Back
            </Button>
            <Box>
              <Typography variant="h5" fontWeight={700}>{product.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {product.category?.name} &nbsp;·&nbsp; /{product.slug}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={product.isActive ? 'Active' : 'Inactive'}
            color={product.isActive ? 'success' : 'default'}
            size="small"
          />
        </Box>
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
            '& .MuiTab-root': { minWidth: 100, fontWeight: 500 }
          }}
        >
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <GeneralTab
              product={product}
              categories={categories}
              onSaved={fetchProduct}
              showToast={showToast}
            />
          )}
          {activeTab === 1 && (
            <FeaturesTab productId={id} showToast={showToast} />
          )}
          {activeTab === 2 && (
            <SimpleListTab
              productId={id}
              label="Eligibility"
              fetchItems={productsService.getEligibility}
              createItem={productsService.createEligibility}
              updateItem={productsService.updateEligibility}
              deleteItem={productsService.deleteEligibility}
              showToast={showToast}
            />
          )}
          {activeTab === 3 && (
            <SimpleListTab
              productId={id}
              label="Document"
              fetchItems={productsService.getDocuments}
              createItem={productsService.createDocument}
              updateItem={productsService.updateDocument}
              deleteItem={productsService.deleteDocument}
              showToast={showToast}
            />
          )}
          {activeTab === 4 && (
            <InterestRatesTab productId={id} showToast={showToast} />
          )}
          {activeTab === 5 && (
            <FaqsTab productId={id} showToast={showToast} />
          )}
          {activeTab === 6 && (
            <EmiTab productId={id} showToast={showToast} />
          )}
          {activeTab === 7 && (
            <SeoTab productId={id} showToast={showToast} />
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

export default ProductEditorPage
