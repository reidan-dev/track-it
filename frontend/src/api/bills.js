import api from './client'

export const getBills = () => api.get('/bills')
export const createBill = (data) => api.post('/bills', data)
export const updateBill = (id, data) => api.put(`/bills/${id}`, data)
export const deleteBill = (id) => api.delete(`/bills/${id}`)
export const payBill = (id, month, year, amount) =>
  api.post(`/bills/${id}/pay/${month}/${year}`, null, { params: amount ? { amount_paid: amount } : {} })
