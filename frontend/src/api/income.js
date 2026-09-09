import api from './client'

export const getIncome = (params) => api.get('/income', { params })
export const createIncome = (data) => api.post('/income', data)
export const updateIncome = (id, data) => api.put(`/income/${id}`, data)
export const deleteIncome = (id) => api.delete(`/income/${id}`)

export const receiveIncome = (id, month, year, { period, amount } = {}) => {
  const params = {}
  if (period != null) params.period = period
  if (amount != null) params.amount = amount
  return api.post(`/income/${id}/receive/${month}/${year}`, null, { params })
}

export const unreceiveIncome = (id, month, year) =>
  api.delete(`/income/${id}/receive/${month}/${year}`)
