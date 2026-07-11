import api from './axios.js'

export const fetchSummary      = (params = {}) => api.get('/api/admin/analytics/summary',            { params })
export const fetchRevenueOverTime = (params = {}) => api.get('/api/admin/analytics/revenue-over-time', { params })
export const fetchRevenueByMachine = (params = {}) => api.get('/api/admin/analytics/revenue-by-machine', { params })
export const fetchTopProducts   = (params = {}) => api.get('/api/admin/analytics/top-products',       { params })
export const fetchPaymentMethods = (params = {}) => api.get('/api/admin/analytics/payment-methods',   { params })
