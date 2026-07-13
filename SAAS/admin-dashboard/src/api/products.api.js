import api from './axios.js'

export const fetchProducts  = (params = {}) => api.get('/api/admin/products',       { params })
export const createProduct  = (data)        => api.post('/api/admin/products',       data)
export const updateProduct  = (id, data)    => api.put(`/api/admin/products/${id}`,  data)
export const deleteProduct  = (id)          => api.delete(`/api/admin/products/${id}`)
