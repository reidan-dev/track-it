import api from './client'

export const getInstallments = () => api.get('/installments')
export const createInstallment = (data) => api.post('/installments', data)
export const updateInstallment = (id, data) => api.put(`/installments/${id}`, data)
export const deleteInstallment = (id) => api.delete(`/installments/${id}`)
export const payInstallment = (id, month, year) => api.post(`/installments/${id}/pay/${month}/${year}`)
