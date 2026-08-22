import api from './api'

const BASE = '/v1/analytics'

// Read-only. Traffic data is written solely by the public website's anonymous
// beacon; the CMS never creates, edits or deletes analytics records.

const getOverview = async (range = '7d') => {
  const response = await api.get(`${BASE}/overview`, { params: { range } })
  return response.data
}

export const analyticsService = {
  getOverview
}
