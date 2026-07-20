import api from './api'

const BASE = '/v1/reviews'

const getAllReviews = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getReviewById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

// Multipart because the customer photo rides along with the fields.
const createReview = async (formData) => {
  const response = await api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateReview = async (id, formData) => {
  const response = await api.put(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteReview = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const toggleReviewStatus = async (id) => {
  const response = await api.patch(`${BASE}/${id}/status`)
  return response.data
}

const reorderReviews = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const reviewService = {
  getAllReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  toggleReviewStatus,
  reorderReviews
}
