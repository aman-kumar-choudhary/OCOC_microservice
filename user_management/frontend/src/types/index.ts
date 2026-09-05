export interface User {
  id: string
  keycloak_user_id?: string
  user_type: string
  status: string
  email: string
  phone?: string
  created_at: string
  updated_at: string
  profile?: Profile
  active_rfid?: string
}

export interface Profile {
  full_name: string
  roll_number?: string
  employee_id?: string
  department?: string
  department_id?: string
  school?: string
  course?: string
  semester?: string
  hostel?: boolean
  guardian_contact?: string
  designation?: string
  hostel_id?: string
  emergency_contact?: string
  photo_reference?: string
  gov_id_type?: string
  gov_id_number?: string
  visit_purpose?: string
  host_contact?: string
  visit_start?: string
  visit_duration_days?: number
}

export interface Role {
  id: string
  name: string
  description: string
  user_type: string
  created_at: string
}

export interface RFIDCard {
  id: string
  uid: string
  status: string
  issued_at?: string
  revoked_at?: string
  revoked_reason?: string
  created_at: string
  user_id?: string
  user_email?: string
}

export interface AuditLog {
  id: string
  actor_id: string
  operation: string
  entity_type: string
  entity_id: string
  before_state: any
  after_state: any
  ip_address: string
  user_agent: string
  created_at: string
}

export interface DashboardOverview {
  total_users: number
  active_users: number
  suspended_users: number
  deactivated_users: number
  students: number
  faculty: number
  workers: number
  visitors: number
  rfid_issued: number
  rfid_active: number
  rfid_revoked: number
}

export interface TrendPoint {
  date: string
  count: number
}

export interface DashboardAnalytics {
  onboarding_trend: TrendPoint[]
  card_issuance_trend: TrendPoint[]
}

export interface PaginatedResponse<T> {
  data: {
    users?: T[]
    cards?: T[]
    logs?: T[]
    total: number
    page: number
    limit: number
    total_pages: number
  }
}

export interface FaceAuthLog {
  id: string
  person_external_id: string
  person_name?: string
  result: 'success' | 'failed' | 'liveness_failed' | 'unknown'
  similarity_score?: number
  liveness_score?: number
  reason?: string
  auth_type: 'single' | 'mass'
  ip_address?: string
  created_at: string
}

export interface FacePoseCapture {
  poseKey: string
  label: string
  description: string
  image: File | null
  previewUrl: string | null
  captured: boolean
}

