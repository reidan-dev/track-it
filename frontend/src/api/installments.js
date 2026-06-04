import api from './client'

export const getInstallments = () => api.get('/installments')
export const createInstallment = (data) => api.post('/installments', data)
export const updateInstallment = (id, data) => api.put(`/installments/${id}`, data)
export const deleteInstallment = (id) => api.delete(`/installments/${id}`)
export const payInstallment = (id, month, year, period = null) =>
  api.post(`/installments/${id}/pay/${month}/${year}`, null, { params: period != null ? { period } : {} })

export const unpayInstallment = (id, month, year, period = null) =>
  api.delete(`/installments/${id}/pay/${month}/${year}`, { params: period != null ? { period } : {} })

export const settleInstallmentParticipant = (id, personId, month, year, period = null) =>
  api.post(`/installments/${id}/settle/${personId}/${month}/${year}`, null, { params: period != null ? { period } : {} })

export const unsettleInstallmentParticipant = (id, personId, month, year, period = null) =>
  api.delete(`/installments/${id}/settle/${personId}/${month}/${year}`, { params: period != null ? { period } : {} })
