import api from './api'

const BASE = '/v1/gemini'

// Every Gemini call goes through the CMS backend. The browser never holds the
// API key: it is sent once, when a Super Admin saves or tests it, and the
// server only ever returns its last four characters.

// ── API configuration (Super Admin) ────────────────────────────────────────────

const getConfig = async () => {
  const response = await api.get(`${BASE}/config`)
  return response.data
}

const saveConfig = async (data) => {
  const response = await api.put(`${BASE}/config`, data)
  return response.data
}

const removeKey = async () => {
  const response = await api.delete(`${BASE}/config/key`)
  return response.data
}

// With no apiKey the saved configuration is tested; with one, that candidate
// key is tested without being saved.
const testConnection = async (apiKey) => {
  const response = await api.post(`${BASE}/config/test`, apiKey ? { apiKey } : {})
  return response.data
}

// ── Blog generation (Super Admin, Editor) ──────────────────────────────────────

const getAvailability = async () => {
  const response = await api.get(`${BASE}/availability`)
  return response.data
}

const generateBlog = async ({ topic, createDate }) => {
  const response = await api.post(`${BASE}/blogs/generate`, { topic, createDate })
  return response.data
}

const generateImage = async ({ title, summary, imagePrompt }) => {
  const response = await api.post(`${BASE}/blogs/image`, { title, summary, imagePrompt })
  return response.data
}

// A month's schedule: topics, dates, categories, tags and keywords to review
// before any blog is generated. Nothing is saved.
const planMonth = async ({ year, month, count }) => {
  const response = await api.post(`${BASE}/blogs/plan`, { year, month, count })
  return response.data
}

// Multipart, same fields as the normal blog create; saved as a draft. With an
// idempotencyKey, repeating a save that already succeeded returns that draft.
const saveDraft = async (formData) => {
  const response = await api.post(`${BASE}/blogs/drafts`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const geminiService = {
  getConfig,
  saveConfig,
  removeKey,
  testConnection,
  getAvailability,
  generateBlog,
  generateImage,
  planMonth,
  saveDraft
}
