import api from './axios.js'

export const fetchOrders      = (params = {}) => api.get('/api/admin/orders',              { params })
export const confirmCash      = (orderId)     => api.post(`/api/admin/orders/${orderId}/confirm-cash`)
