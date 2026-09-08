import api from './api'
import axios from 'axios'

export interface RegistrationPayload {
  role: string
  full_name: string
  email: string
  phone: string
  roll_number?: string
  employee_id?: string
  department_id?: string
  hostel_id?: string
  emergency_contact?: string
  guardian_contact?: string
  gov_id_type?: string
  gov_id_number?: string
  visit_purpose?: string
  host_contact?: string
  visit_start?: string
  visit_duration_days?: number
  worker_type?: string
}

export interface RegisteredUser {
  id: string
  role: string
  full_name: string
  email: string
  phone: string
  status: string
  created_at: string
  roll_number?: string
  employee_id?: string
  department_id?: string
  hostel_id?: string
  emergency_contact?: string
  guardian_contact?: string
  gov_id_type?: string
  gov_id_number?: string
  visit_purpose?: string
  host_contact?: string
}

export interface RegistrationListResult {
  users: RegisteredUser[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface RegistrationStats {
  total: number
  students: number
  faculty: number
  workers: number
  visitors: number
}

// Public registration — no auth token needed
const publicApi = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export default {
  // Public endpoint — no JWT required
  async register(payload: RegistrationPayload): Promise<RegisteredUser> {
    const { data } = await publicApi.post('/register', payload)
    return data.data
  },

  // Admin endpoints — JWT required
  async listRegistrations(params: { role?: string; page?: number; limit?: number }): Promise<RegistrationListResult> {
    const { data } = await api.get('/registrations', { params })
    return data.data
  },

  async getStats(): Promise<RegistrationStats> {
    const { data } = await api.get('/registrations/stats')
    return data.data
  },
}
