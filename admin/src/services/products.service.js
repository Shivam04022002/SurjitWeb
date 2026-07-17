import api from './api'

// ── Product Categories ────────────────────────────────────────────────────────

const getAllCategories = async () => {
  const response = await api.get('/v1/products/categories')
  return response.data
}

const getCategoryById = async (id) => {
  const response = await api.get(`/v1/products/categories/${id}`)
  return response.data
}

const createCategory = async (formData) => {
  const response = await api.post('/v1/products/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateCategory = async (id, formData) => {
  const response = await api.put(`/v1/products/categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteCategory = async (id) => {
  const response = await api.delete(`/v1/products/categories/${id}`)
  return response.data
}

const toggleCategoryStatus = async (id) => {
  const response = await api.patch(`/v1/products/categories/${id}/status`)
  return response.data
}

const reorderCategories = async (ids) => {
  const response = await api.patch('/v1/products/categories/reorder', { ids })
  return response.data
}

// ── Products ──────────────────────────────────────────────────────────────────

const getAllProducts = async (params = {}) => {
  const response = await api.get('/v1/products', { params })
  return response.data
}

const getProductById = async (id) => {
  const response = await api.get(`/v1/products/${id}`)
  return response.data
}

const createProduct = async (formData) => {
  const response = await api.post('/v1/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateProduct = async (id, formData) => {
  const response = await api.put(`/v1/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteProduct = async (id) => {
  const response = await api.delete(`/v1/products/${id}`)
  return response.data
}

const toggleProductStatus = async (id) => {
  const response = await api.patch(`/v1/products/${id}/status`)
  return response.data
}

const reorderProducts = async (ids) => {
  const response = await api.patch('/v1/products/reorder', { ids })
  return response.data
}

// ── Features ──────────────────────────────────────────────────────────────────

const getFeatures = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/features`)
  return response.data
}

const createFeature = async (productId, formData) => {
  const response = await api.post(`/v1/products/${productId}/features`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateFeature = async (id, formData) => {
  const response = await api.put(`/v1/products/features/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteFeature = async (id) => {
  const response = await api.delete(`/v1/products/features/${id}`)
  return response.data
}

const reorderFeatures = async (productId, ids) => {
  const response = await api.patch('/v1/products/features/reorder', { ids, productId })
  return response.data
}

// ── Eligibility ───────────────────────────────────────────────────────────────

const getEligibility = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/eligibility`)
  return response.data
}

const createEligibility = async (productId, data) => {
  const response = await api.post(`/v1/products/${productId}/eligibility`, data)
  return response.data
}

const updateEligibility = async (id, data) => {
  const response = await api.put(`/v1/products/eligibility/${id}`, data)
  return response.data
}

const deleteEligibility = async (id) => {
  const response = await api.delete(`/v1/products/eligibility/${id}`)
  return response.data
}

const reorderEligibility = async (productId, ids) => {
  const response = await api.patch('/v1/products/eligibility/reorder', { ids, productId })
  return response.data
}

// ── Documents ─────────────────────────────────────────────────────────────────

const getDocuments = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/documents`)
  return response.data
}

const createDocument = async (productId, data) => {
  const response = await api.post(`/v1/products/${productId}/documents`, data)
  return response.data
}

const updateDocument = async (id, data) => {
  const response = await api.put(`/v1/products/documents/${id}`, data)
  return response.data
}

const deleteDocument = async (id) => {
  const response = await api.delete(`/v1/products/documents/${id}`)
  return response.data
}

const reorderDocuments = async (productId, ids) => {
  const response = await api.patch('/v1/products/documents/reorder', { ids, productId })
  return response.data
}

// ── Interest Rates ────────────────────────────────────────────────────────────

const getInterestRates = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/interest-rates`)
  return response.data
}

const createInterestRate = async (productId, data) => {
  const response = await api.post(`/v1/products/${productId}/interest-rates`, data)
  return response.data
}

const updateInterestRate = async (id, data) => {
  const response = await api.put(`/v1/products/interest-rates/${id}`, data)
  return response.data
}

const deleteInterestRate = async (id) => {
  const response = await api.delete(`/v1/products/interest-rates/${id}`)
  return response.data
}

const reorderInterestRates = async (productId, ids) => {
  const response = await api.patch('/v1/products/interest-rates/reorder', { ids, productId })
  return response.data
}

// ── FAQs ──────────────────────────────────────────────────────────────────────

const getFaqs = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/faqs`)
  return response.data
}

const createFaq = async (productId, data) => {
  const response = await api.post(`/v1/products/${productId}/faqs`, data)
  return response.data
}

const updateFaq = async (id, data) => {
  const response = await api.put(`/v1/products/faqs/${id}`, data)
  return response.data
}

const deleteFaq = async (id) => {
  const response = await api.delete(`/v1/products/faqs/${id}`)
  return response.data
}

const reorderFaqs = async (productId, ids) => {
  const response = await api.patch('/v1/products/faqs/reorder', { ids, productId })
  return response.data
}

// ── EMI Config ────────────────────────────────────────────────────────────────

const getEmiConfig = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/emi`)
  return response.data
}

const updateEmiConfig = async (productId, data) => {
  const response = await api.put(`/v1/products/${productId}/emi`, data)
  return response.data
}

// ── SEO ───────────────────────────────────────────────────────────────────────

const getSeo = async (productId) => {
  const response = await api.get(`/v1/products/${productId}/seo`)
  return response.data
}

const updateSeo = async (productId, formData) => {
  const response = await api.put(`/v1/products/${productId}/seo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const productsService = {
  getAllCategories, getCategoryById, createCategory, updateCategory,
  deleteCategory, toggleCategoryStatus, reorderCategories,
  getAllProducts, getProductById, createProduct, updateProduct,
  deleteProduct, toggleProductStatus, reorderProducts,
  getFeatures, createFeature, updateFeature, deleteFeature, reorderFeatures,
  getEligibility, createEligibility, updateEligibility, deleteEligibility, reorderEligibility,
  getDocuments, createDocument, updateDocument, deleteDocument, reorderDocuments,
  getInterestRates, createInterestRate, updateInterestRate, deleteInterestRate, reorderInterestRates,
  getFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs,
  getEmiConfig, updateEmiConfig,
  getSeo, updateSeo
}
