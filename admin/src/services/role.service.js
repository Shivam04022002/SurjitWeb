import api from './api'

const BASE = '/v1/roles'

// Roles and page permissions. The catalogue and a role's levels both come from
// the server, so the matrix an administrator fills in is the same one the API
// enforces — there is no page list duplicated in the CMS.

const getAllRoles = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getRoleById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const getPermissionCatalogue = async () => {
  const response = await api.get(`${BASE}/catalogue`)
  return response.data
}

// What the signed-in admin may reach. Every session asks once, and again
// whenever a role changes underneath it.
const getMyPermissions = async () => {
  const response = await api.get(`${BASE}/me/permissions`)
  return response.data
}

const createRole = async (payload) => {
  const response = await api.post(BASE, payload)
  return response.data
}

const updateRole = async (id, payload) => {
  const response = await api.put(`${BASE}/${id}`, payload)
  return response.data
}

export const roleService = {
  getAllRoles,
  getRoleById,
  getPermissionCatalogue,
  getMyPermissions,
  createRole,
  updateRole
}
