import api from './client'

export const getPaymentMethods = () => api.get('/payment-methods')
export const createPaymentMethod = (data) => api.post('/payment-methods', data)
export const updatePaymentMethod = (id, data) => api.put(`/payment-methods/${id}`, data)
export const deletePaymentMethod = (id) => api.delete(`/payment-methods/${id}`)
