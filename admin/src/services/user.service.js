import api from './api'

const BASE = '/v1/users'

// CMS users are Admin accounts. Every route here is Super Admin only.

const getAllUsers = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getUserById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const createUser = async (data) => {
  const response = await api.post(BASE, data)
  return response.data
}

const updateUser = async (id, data) => {
  const response = await api.put(`${BASE}/${id}`, data)
  return response.data
}

const deleteUser = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

export const userService = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
}
