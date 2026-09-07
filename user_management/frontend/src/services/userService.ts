import api from './api'
import type { User, PaginatedResponse } from '@/types'

export default {
  async list(params: any): Promise<PaginatedResponse<User>['data']> {
    const { data } = await api.get('/users', { params })
    return data.data
  },
  
  async getById(id: string): Promise<User> {
    const { data } = await api.get(`/users/${id}`)
    return data.data
  },
  
  async update(id: string, payload: any): Promise<User> {
    const { data } = await api.patch(`/users/${id}`, payload)
    return data.data
  },
  
  async suspend(id: string): Promise<void> {
    await api.patch(`/users/${id}/suspend`)
  },
  
  async activate(id: string): Promise<void> {
    await api.patch(`/users/${id}/activate`)
  },
  
  async deactivate(id: string): Promise<void> {
    await api.patch(`/users/${id}/deactivate`)
  },
  
  async onboard(persona: string, payload: any): Promise<any> {
    const { data } = await api.post(`/onboarding/${persona}`, payload)
    return data.data
  },

  async enrollRFID(userId: string, uid: string): Promise<any> {
    const { data } = await api.post(`/onboarding/${userId}/rfid`, { uid })
    return data.data
  },

  async issueCard(userId: string): Promise<any> {
    const { data } = await api.post(`/onboarding/${userId}/issue-card`)
    return data.data
  },

  async importCsv(file: File): Promise<any> {
    const text = await file.text()
    const { data } = await api.post('/users/import', text, {
      headers: { 'Content-Type': 'text/csv' }
    })
    return data.data
  },

  async getDepartments(): Promise<any[]> {
    const { data } = await api.get('/departments')
    return data.data
  },

  async getHostels(): Promise<any[]> {
    const { data } = await api.get('/hostels')
    return data.data
  }
}
