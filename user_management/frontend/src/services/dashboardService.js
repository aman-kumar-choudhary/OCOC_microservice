import api from './api'

export default {
  async getOverview() {
    const { data } = await api.get('/dashboard/overview')
    return data.data
  },

  async getAnalytics() {
    const { data } = await api.get('/dashboard/analytics')
    return data.data
  },

  async getAnalyticsWithDateRange(from, to) {
    const { data } = await api.get('/dashboard/analytics', { params: { from, to } })
    return data.data
  }
}
