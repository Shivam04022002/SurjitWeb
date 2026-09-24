import api from './api'
import { requestConfig } from '../pages/advertisements/advertisementUtils'

const BASE = '/v1/advertisements'

// Create and update send multipart when an image was picked, so the file goes
// through the server's own upload middleware — the browser never sets imageUrl
// or the storage key itself.

const getAllAdvertisements = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getAdvertisementById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const createAdvertisement = async (payload) => {
  const response = await api.post(BASE, payload, requestConfig(payload))
  return response.data
}

const updateAdvertisement = async (id, payload) => {
  const response = await api.put(`${BASE}/${id}`, payload, requestConfig(payload))
  return response.data
}

const publishAdvertisement = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishAdvertisement = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const deleteAdvertisement = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

export const advertisementService = {
  getAllAdvertisements,
  getAdvertisementById,
  createAdvertisement,
  updateAdvertisement,
  publishAdvertisement,
  unpublishAdvertisement,
  deleteAdvertisement
}
