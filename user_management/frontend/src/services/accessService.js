import api from './api'

const accessService = {
  // ── Locations ──
  getLocations: async () => {
    const { data } = await api.get('/access/locations')
    return data.data
  },

  // ── Rules ──
  getRules: async () => {
    const { data } = await api.get('/access/rules')
    return data.data
  },
  
  createRule: async (payload) => {
    const { data } = await api.post('/access/rules', payload)
    return data.data
  },
  
  updateRule: async (id, updates) => {
    const { data } = await api.patch(`/access/rules/${id}`, updates)
    return data.data
  },

  // ── Temporary Grants ──
  getTemporaryGrants: async () => {
    const { data } = await api.get('/access/temporary-grants')
    return data.data
  },
  
  createTemporaryGrant: async (payload) => {
    const { data } = await api.post('/access/temporary-grants', payload)
    return data.data
  },

  // ── Events / Alerts ──
  getEvents: async (params) => {
    const { data } = await api.get('/access/events', { params })
    return data.data
  },
  
  evaluateAccess: async (payload) => {
    const { data } = await api.post('/access/evaluate', payload)
    return data.data
  }
}

export default accessService
