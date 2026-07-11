import api from './axios.js'

export const fetchDevices    = (params = {}) => api.get('/api/admin/devices',     { params })
export const registerDevice  = (data)        => api.post('/api/admin/devices',    data)
export const updateDevice    = (id, data)    => api.put(`/api/admin/devices/${id}`, data)
