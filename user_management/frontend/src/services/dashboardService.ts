import api from './api'
import type { DashboardOverview, DashboardAnalytics } from '@/types'

export default {
  async getOverview(): Promise<DashboardOverview> {
    const { data } = await api.get('/dashboard/overview')
    return data.data
  },
  
  async getAnalytics(): Promise<DashboardAnalytics> {
    const { data } = await api.get('/dashboard/analytics')
    return data.data
  }
}
