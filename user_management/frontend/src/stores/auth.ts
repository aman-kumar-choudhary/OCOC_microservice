import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { jwtDecode } from 'jwt-decode'
import api from '@/services/api'

interface KeycloakClaims {
  sub: string
  email: string
  preferred_username: string
  realm_access: {
    roles: string[]
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('access_token'))
  const user = ref<KeycloakClaims | null>(null)
  const isInitializing = ref(true)

  const isAuthenticated = computed(() => !!token.value)
  const roles = computed(() => user.value?.realm_access?.roles || [])
  const email = computed(() => user.value?.email || '')
  
  const hasRole = (role: string) => roles.value.includes(role)
  const hasAnyRole = (checkRoles: string[]) => checkRoles.some(r => hasRole(r))

  function parseToken(t: string) {
    try {
      user.value = jwtDecode<KeycloakClaims>(t)
    } catch (e) {
      console.error('Invalid token', e)
      logout()
    }
  }

  if (token.value) {
    parseToken(token.value)
  }
  isInitializing.value = false

  async function login(credentials: any) {
    const { data } = await api.post('/auth/login', credentials)
    const { access_token, refresh_token } = data.data
    
    token.value = access_token
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    
    parseToken(access_token)
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken })
      } catch (e) {
        console.error('Logout failed on server', e)
      }
    }
    token.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  return {
    token,
    user,
    isInitializing,
    isAuthenticated,
    roles,
    email,
    hasRole,
    hasAnyRole,
    login,
    logout
  }
})
