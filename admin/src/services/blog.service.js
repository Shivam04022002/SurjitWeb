import api from './api'

const BASE = '/v1/blogs'

// ── Blogs ──────────────────────────────────────────────────────────────────────

const getAllBlogs = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getBlogById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

// Multipart because the featured image and OG image ride along with the fields.
const createBlog = async (formData) => {
  const response = await api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateBlog = async (id, formData) => {
  const response = await api.put(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteBlog = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishBlog = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishBlog = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const duplicateBlog = async (id) => {
  const response = await api.post(`${BASE}/${id}/duplicate`)
  return response.data
}

const uploadInlineImage = async (formData) => {
  const response = await api.post(`${BASE}/uploads/inline`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

// ── Categories ─────────────────────────────────────────────────────────────────

const getAllCategories = async (params = {}) => {
  const response = await api.get(`${BASE}/categories`, { params })
  return response.data
}

const createCategory = async (data) => {
  const response = await api.post(`${BASE}/categories`, data)
  return response.data
}

const updateCategory = async (id, data) => {
  const response = await api.put(`${BASE}/categories/${id}`, data)
  return response.data
}

const deleteCategory = async (id) => {
  const response = await api.delete(`${BASE}/categories/${id}`)
  return response.data
}

const toggleCategoryStatus = async (id) => {
  const response = await api.patch(`${BASE}/categories/${id}/status`)
  return response.data
}

export const blogService = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
  unpublishBlog,
  duplicateBlog,
  uploadInlineImage,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
}
