import api from './api'

const BASE = '/v1/gallery'

// ── Albums ─────────────────────────────────────────────────────────────────────

const getAllAlbums = async (params = {}) => {
  const response = await api.get(`${BASE}/albums`, { params })
  return response.data
}

const getAlbumById = async (id) => {
  const response = await api.get(`${BASE}/albums/${id}`)
  return response.data
}

const createAlbum = async (formData) => {
  const response = await api.post(`${BASE}/albums`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateAlbum = async (id, formData) => {
  const response = await api.put(`${BASE}/albums/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteAlbum = async (id) => {
  const response = await api.delete(`${BASE}/albums/${id}`)
  return response.data
}

const toggleAlbumStatus = async (id) => {
  const response = await api.patch(`${BASE}/albums/${id}/status`)
  return response.data
}

const reorderAlbums = async (ids) => {
  const response = await api.patch(`${BASE}/albums/reorder`, { ids })
  return response.data
}

// ── Images ─────────────────────────────────────────────────────────────────────

const getImagesByAlbum = async (albumId, params = {}) => {
  const response = await api.get(`${BASE}/albums/${albumId}/images`, { params })
  return response.data
}

const uploadImages = async (albumId, formData) => {
  const response = await api.post(`${BASE}/albums/${albumId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateImage = async (id, data) => {
  const response = await api.put(`${BASE}/images/${id}`, data)
  return response.data
}

const deleteImage = async (id) => {
  const response = await api.delete(`${BASE}/images/${id}`)
  return response.data
}

const toggleImageStatus = async (id) => {
  const response = await api.patch(`${BASE}/images/${id}/status`)
  return response.data
}

const reorderImages = async (ids) => {
  const response = await api.patch(`${BASE}/images/reorder`, { ids })
  return response.data
}

// ── ZIP Import ─────────────────────────────────────────────────────────────────

const importZip = async (albumId, formData, onUploadProgress) => {
  const response = await api.post(`${BASE}/albums/${albumId}/import-zip`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  })
  return response.data
}

export const galleryService = {
  getAllAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  toggleAlbumStatus,
  reorderAlbums,
  getImagesByAlbum,
  uploadImages,
  updateImage,
  deleteImage,
  toggleImageStatus,
  reorderImages,
  importZip
}
