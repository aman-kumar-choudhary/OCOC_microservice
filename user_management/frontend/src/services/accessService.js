import api from "./api";

const accessService = {
  // ── Locations ──
  getLocations: async () => {
    const { data } = await api.get("/access/locations");
    return data.data;
  },
  getUserAccess: async (userId) => {
    const { data } = await api.get(`/access/users/${userId}/access`);
    return data.data;
  },
  updateUserAccess: async (userId, payload) => {
    const { data } = await api.put(`/access/users/${userId}/access`, payload);
    return data.data;
  },
  issueUserCredentials: async (userId, customPassword = null) => {
    const { data } = await api.post(`/access/users/${userId}/credentials`, {
      custom_password: customPassword || undefined,
    });
    return data.data;
  },
  getGroups: async () => {
    const { data } = await api.get("/access/groups");
    return data.data;
  },
  // ── Enhanced User Access & Search ──
  searchAccessUsers: async (params) => {
    const { data } = await api.get("/access/manage/users", { params });
    return data.data;
  },
  getAccessUserDetail: async (userId) => {
    const { data } = await api.get(`/access/manage/users/${userId}`);
    return data.data;
  },
  getUserEffectivePermissions: async (userId) => {
    const { data } = await api.get(
      `/access/manage/users/${userId}/permissions`,
    );
    return data.data;
  },
  getLocationTree: async () => {
    const { data } = await api.get("/access/locations/tree");
    return data.data;
  },

  // ── Location Grants CRUD ──
  syncUserLocations: async (userId, locationIds, accessLevel = "ENTRY", reason = "Assigned via Access Management") => {
    const { data } = await api.put(`/access/users/${userId}/locations`, {
      location_ids: locationIds,
      access_level: accessLevel,
      reason,
    });
    return data.data;
  },
  createLocationGrant: async (payload) => {
    const { data } = await api.post("/access/grants", payload);
    return data.data;
  },
  updateLocationGrant: async (grantId, payload) => {
    const { data } = await api.put(`/access/grants/${grantId}`, payload);
    return data.data;
  },
  revokeLocationGrant: async (grantId) => {
    const { data } = await api.delete(`/access/grants/${grantId}`);
    return data.data;
  },

  // ── Access Audit Logs ──
  getAccessAuditLogs: async (params) => {
    const { data } = await api.get("/access/audit-logs", { params });
    return data.data;
  },

  // ── Rules ──
  getRules: async () => {
    const { data } = await api.get("/access/rules");
    return data.data;
  },
  getRuleStats: async () => {
    const { data } = await api.get("/access/rules/stats");
    return data.data;
  },
  getDevices: async () => {
    const { data } = await api.get("/access/devices");
    return data.data;
  },
  getOccupancy: async (locationId) => {
    const { data } = await api.get("/access/occupancy", {
      params: locationId ? { location_id: locationId } : {},
    });
    return data.data;
  },

  createRule: async (payload) => {
    const { data } = await api.post("/access/rules", payload);
    return data.data;
  },

  updateRule: async (id, updates) => {
    const { data } = await api.patch(`/access/rules/${id}`, updates);
    return data.data;
  },

  // ── Temporary Grants ──
  getTemporaryGrants: async () => {
    const { data } = await api.get("/access/temporary-grants");
    return data.data;
  },

  createTemporaryGrant: async (payload) => {
    const { data } = await api.post("/access/temporary-grants", payload);
    return data.data;
  },

  // ── Events / Alerts ──
  getEvents: async (params) => {
    const { data } = await api.get("/access/events", { params });
    return data.data;
  },
  getGuardHostelLeaves: async () => {
    const { data } = await api.get("/access/guard/hostel-leaves");
    return data.data;
  },

  evaluateAccess: async (payload) => {
    const { data } = await api.post("/access/evaluate", payload);
    return data.data;
  },
  scan: async (payload) => {
    const { data } = await api.post("/access/scan", payload);
    return data.data;
  },
  verifyFace: async (payload) => {
    const { data } = await api.post("/access/verify-face", payload);
    return data.data;
  },

  // ── Guard Movement & Visitor Operations ──
  recordGuardMovement: async (payload) => {
    const { data } = await api.post("/access/guard/movement", payload);
    return data;
  },
  registerGuardVisitor: async (payload) => {
    const { data } = await api.post("/access/guard/visitor", payload);
    return data;
  },
  getGuardVisitors: async (limit = 50) => {
    const { data } = await api.get(`/access/guard/visitors?limit=${limit}`);
    return data.data;
  },
  checkoutGuardVisitor: async (visitorId) => {
    const { data } = await api.post(`/access/guard/visitor/${visitorId}/checkout`);
    return data;
  },

  assignGuardDuty: async (payload) => {
    const { data } = await api.post("/access/security-admin/assign-duty", payload);
    return data;
  },
  getSecurityAdminOverview: async () => {
    const { data } = await api.get("/access/security-admin/overview");
    return data.data;
  },
  executeSecurityCommand: async (payload) => {
    const { data } = await api.post("/access/security-admin/command", payload);
    return data;
  },
};

export default accessService;

