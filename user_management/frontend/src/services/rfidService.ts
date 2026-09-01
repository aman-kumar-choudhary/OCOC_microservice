import api from './api'
import type { RFIDCard, PaginatedResponse } from '@/types'

export default {
  async list(params: any): Promise<PaginatedResponse<RFIDCard>['data']> {
    const { data } = await api.get('/rfid', { params })
    return data.data
  },
  
  async getByUid(uid: string): Promise<RFIDCard> {
    const { data } = await api.get(`/rfid/${uid}`)
    return data.data
  },
  
  async scan(): Promise<{uid: string, status: string}> {
    const { data } = await api.post('/rfid/scan')
    return data.data
  },
  
  async validate(uid: string): Promise<{valid: boolean, reason: string}> {
    const { data } = await api.post('/rfid/validate', { uid })
    return data.data
  },
  
  async assign(userId: string, uid: string): Promise<RFIDCard> {
    const { data } = await api.post('/rfid/assign', { user_id: userId, uid })
    return data.data
  },
  
  async replace(userId: string, newUid: string, reason: string): Promise<RFIDCard> {
    const { data } = await api.post('/rfid/replace', { user_id: userId, new_uid: newUid, reason })
    return data.data
  },
  
  async revoke(id: string, reason: string): Promise<void> {
    await api.patch(`/rfid/${id}/revoke`, { reason })
  }
}
