import api from './api'

const BASE = '/v1/analytics'

// Read-only. Traffic data is written solely by the public website's anonymous
// beacons; the CMS never creates, edits or deletes analytics records.

// `range` is a preset key, or 'custom' with `from` / `to` as YYYY-MM-DD.
const rangeParams = ({ range = '7d', from, to } = {}) =>
  range === 'custom' ? { range, from, to } : { range }

const getOverview = async (range) => {
  const response = await api.get(`${BASE}/overview`, { params: rangeParams(range) })
  return response.data
}

const getPages = async (range, { page = 1, limit = 25 } = {}) => {
  const response = await api.get(`${BASE}/pages`, { params: { ...rangeParams(range), page, limit } })
  return response.data
}

export const analyticsService = {
  getOverview,
  getPages
}
