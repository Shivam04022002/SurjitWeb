import api from './api'

const BASE = '/v1/settings'

const getSettings = async () => {
  const response = await api.get(BASE)
  return response.data
}

const updateSettings = async (formData) => {
  const response = await api.put(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const settingsService = { getSettings, updateSettings }
