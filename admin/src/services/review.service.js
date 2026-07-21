import api from './api'

const BASE = '/v1/reviews'

// Moderation only. Reviews are written by customers through the public website
// endpoint, so there is deliberately no create or update call here.

const getAllReviews = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getReviewById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const approveReview = async (id) => {
  const response = await api.patch(`${BASE}/${id}/approve`)
  return response.data
}

const rejectReview = async (id) => {
  const response = await api.patch(`${BASE}/${id}/reject`)
  return response.data
}

const deleteReview = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const reorderReviews = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const reviewService = {
  getAllReviews,
  getReviewById,
  approveReview,
  rejectReview,
  deleteReview,
  reorderReviews
}
