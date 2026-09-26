import api from './api'
import { rangeParams } from '../pages/analytics/analyticsRange'

const BASE = '/v1/analytics'

// Read-only. Traffic data is written solely by the public website's anonymous
// beacons; the CMS never creates, edits or deletes analytics records.
//
// A window is a preset key, or 'custom' with `from` / `to` as UTC calendar
// days. What that means is defined once, in analyticsRange.

const getOverview = async (range) => {
  const response = await api.get(`${BASE}/overview`, { params: rangeParams(range) })
  return response.data
}

const getPages = async (range, { page = 1, limit = 25 } = {}) => {
  const response = await api.get(`${BASE}/pages`, { params: { ...rangeParams(range), page, limit } })
  return response.data
}

// Every city in the window, paginated and searchable — what the dashboard's
// "See All" reads. The window is the same global filter the rest of the page
// uses, so the list can never be showing a different period than the card.
const getCities = async (range, { page = 1, limit = 25, search = '' } = {}) => {
  const params = { ...rangeParams(range), page, limit }
  if (search) params.search = search
  const response = await api.get(`${BASE}/cities`, { params })
  return response.data
}

export const analyticsService = {
  getOverview,
  getPages,
  getCities
}
