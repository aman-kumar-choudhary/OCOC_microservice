import api from './api'
import type { Role, AuditLog, PaginatedResponse } from '@/types'

export const roleService = {
  async list(): Promise<Role[]> {
    const { data } = await api.get('/roles')
    return data.data
  },
  
  async assignToUser(userId: string, roleId: string): Promise<void> {
    await api.post(`/users/${userId}/roles`, { role_id: roleId })
  },
  
  async removeFromUser(userId: string, roleId: string): Promise<void> {
    await api.delete(`/users/${userId}/roles/${roleId}`)
  }
}

export const auditService = {
  async list(params: any): Promise<PaginatedResponse<AuditLog>['data']> {
    const { data } = await api.get('/audit', { params })
    return data.data
  },
  
  async getById(id: string): Promise<AuditLog> {
    const { data } = await api.get(`/audit/${id}`)
    return data.data
  }
}
