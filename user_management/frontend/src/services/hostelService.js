import api from "./api";

export const hostelService = {
  getDashboardStats: async (hostelId) => {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const response = await api.get("/hostel/dashboard", { params });
    return response.data;
  },

  getLiveStatus: async (hostelId) => {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const response = await api.get("/hostel/students/live", { params });
    return response.data;
  },
  getPermissions: async (hostelId = null) => {
    let url = "/hostel/permissions";
    if (hostelId) {
      url += `?hostel_id=${hostelId}`;
    }
    const res = await api.get(url);
    return res.data;
  },

  grantPermission: async (data) => {
    const response = await api.post("/hostel/permissions", data);
    return response.data;
  },

  revokePermission: async (permissionId) => {
    const response = await api.delete(`/hostel/permissions/${permissionId}`);
    return response.data;
  },

  getMovementHistory: async (hostelId) => {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const response = await api.get("/hostel/movement", { params });
    return response.data;
  },

  getAlerts: async (hostelId) => {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const response = await api.get("/hostel/alerts", { params });
    return response.data;
  },

  getEmergencyHeadcount: async (hostelId) => {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const response = await api.get("/hostel/emergency-headcount", { params });
    return response.data;
  },
};
