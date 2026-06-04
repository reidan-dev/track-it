import api from './client'

export const getBills = () => api.get('/bills')
export const createBill = (data) => api.post('/bills', data)
export const updateBill = (id, data) => api.put(`/bills/${id}`, data)
export const deleteBill = (id) => api.delete(`/bills/${id}`)
export const payBill = (id, month, year, { period, amount } = {}) => {
  const params = {}
  if (period != null) params.period = period
  if (amount != null) params.amount_paid = amount
  return api.post(`/bills/${id}/pay/${month}/${year}`, null, { params })
}

export const unpayBill = (id, month, year, { period } = {}) => {
  const params = {}
  if (period != null) params.period = period
  return api.delete(`/bills/${id}/pay/${month}/${year}`, { params })
}

export const settleBillParticipant = (id, personId, month, year, period = null) =>
  api.post(`/bills/${id}/settle/${personId}/${month}/${year}`, null, { params: period != null ? { period } : {} })

export const unsettleBillParticipant = (id, personId, month, year, period = null) =>
  api.delete(`/bills/${id}/settle/${personId}/${month}/${year}`, { params: period != null ? { period } : {} })
