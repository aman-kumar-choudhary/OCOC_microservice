import api from "./api";

export const roleService = {
  async list() {
    const { data } = await api.get("/roles");
    return data.data;
  },

  async assignToUser(userId, roleId) {
    await api.post(`/users/${userId}/roles`, { role_id: roleId });
  },

  async removeFromUser(userId, roleId) {
    await api.delete(`/users/${userId}/roles/${roleId}`);
  },
};
export const auditService = {
  async list(params) {
    const { data } = await api.get("/audit", { params });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/audit/${id}`);
    return data.data;
  },
};
