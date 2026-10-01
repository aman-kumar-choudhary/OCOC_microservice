import api from "./api";

export default {
  async list(params) {
    const { data } = await api.get("/users", { params });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/users/${id}`);
    return data.data;
  },

  async update(id, payload) {
    const { data } = await api.patch(`/users/${id}`, payload);
    return data.data;
  },
  async suspend(id) {
    await api.patch(`/users/${id}/suspend`);
  },

  async activate(id) {
    await api.patch(`/users/${id}/activate`);
  },

  async deactivate(id) {
    await api.patch(`/users/${id}/deactivate`);
  },

  async remove(id) {
    await api.delete(`/users/${id}`);
  },

  async onboard(persona, payload) {
    const { data } = await api.post(`/onboarding/${persona}`, payload);
    return data.data;
  },

  async enrollRFID(userId, uid) {
    const { data } = await api.post(`/onboarding/${userId}/rfid`, { uid });
    return data.data;
  },

  async issueCard(userId) {
    const { data } = await api.post(`/onboarding/${userId}/issue-card`);
    return data.data;
  },

  async importCsv(file) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/users/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async getDepartments() {
    const { data } = await api.get("/departments");
    return data.data;
  },

  async getHostels() {
    try {
      const { data } = await api.get("/hostels");
      return data.data;
    } catch {
      const { data } = await api.get("/reference/hostels");
      return data.data;
    }
  },

  async getLocations() {
    try {
      const { data } = await api.get("/locations");
      return data.data;
    } catch {
      const { data } = await api.get("/access/locations");
      return data.data;
    }
  },

  async getProfile() {
    const { data } = await api.get("/users/me");
    return data.data;
  },
};
