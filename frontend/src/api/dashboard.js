import api from './client'

export const getDashboardSummary = (month, year) =>
  api.get('/dashboard/summary', { params: { month, year } })

export const getDashboardTrends = (months = 6) =>
  api.get('/dashboard/trends', { params: { months } })

export const getCalendarEvents = (month, year) =>
  api.get('/calendar/events', { params: { month, year } })
