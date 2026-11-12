import api from './client'

export const getSharedTracker = (month, year) => api.get('/shared-tracker', { params: { month, year } })
export const addSharedTrackerRow = (label) => api.post('/shared-tracker/rows', { label })
export const updateSharedTrackerRow = (id, data) => api.put(`/shared-tracker/rows/${id}`, data)
export const deleteSharedTrackerRow = (id) => api.delete(`/shared-tracker/rows/${id}`)
export const updateSharedTrackerEntry = (id, data) => api.patch(`/shared-tracker/entries/${id}`, data)
export const getShareLink = () => api.get('/shared-tracker/share-link')

export const getPublicSharedTracker = (token, month, year) =>
  api.get(`/public/shared-tracker/${token}`, { params: { month, year } })
export const updatePublicSharedTrackerEntry = (token, id, data) =>
  api.patch(`/public/shared-tracker/${token}/entries/${id}`, data)
