import api from "./api";
import axios from "axios";

// Public registration — no auth token needed
const publicApi = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

export default {
  // Public endpoint — no JWT required
  async register(payload) {
    const { data } = await publicApi.post("/register", payload);
    return data.data;
  },

  async getDepartments() {
    try {
      const { data } = await publicApi.get("/departments");
      return data.data || [];
    } catch {
      return [];
    }
  },
  async getHostels() {
    try {
      const { data } = await publicApi.get("/reference/hostels");
      return data.data || [];
    } catch {
      return [];
    }
  },

  async getLocations() {
    try {
      const { data } = await publicApi.get("/reference/locations");
      return data.data || [];
    } catch {
      return [];
    }
  },

  // Admin endpoints — JWT required
  async listRegistrations(params) {
    const { data } = await api.get("/registrations", { params });
    return data.data;
  },

  async getStats() {
    const { data } = await api.get("/registrations/stats");
    return data.data;
  },
};
