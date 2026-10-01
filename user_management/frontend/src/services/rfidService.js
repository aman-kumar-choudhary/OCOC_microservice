import api from "./api";

export default {
  async list(params) {
    const { data } = await api.get("/rfid", { params });
    return data.data;
  },

  async getByUid(uid) {
    const { data } = await api.get(`/rfid/${uid}`);
    return data.data;
  },

  async scan() {
    const { data } = await api.post("/rfid/scan");
    return data.data;
  },

  async validate(uid) {
    const { data } = await api.post("/rfid/validate", { uid });
    return data.data;
  },
  async assign(userId, uid) {
    const { data } = await api.post("/rfid/assign", { user_id: userId, uid });
    return data.data;
  },

  async replace(userId, newUid, reason) {
    const { data } = await api.post("/rfid/replace", {
      user_id: userId,
      new_uid: newUid,
      reason,
    });
    return data.data;
  },

  async revoke(id, reason) {
    await api.patch(`/rfid/${id}/revoke`, { reason });
  },
};
