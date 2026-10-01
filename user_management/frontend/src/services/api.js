import axios from "axios";

let refreshRequest = null;

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh");

    // If error is 401 on an authenticated request and we haven't tried refreshing yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = sessionStorage.getItem("refresh_token");
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        // Try to refresh token
        // Refresh-token rotation is one-time. Share one refresh call when several
        // requests expire together so they do not invalidate each other's token.
        if (!refreshRequest) {
          refreshRequest = axios
            .post("/api/v1/auth/refresh", { refresh_token: refreshToken })
            .then(({ data }) => {
              const tokens = data.data;
              sessionStorage.setItem("access_token", tokens.access_token);
              if (tokens.refresh_token)
                sessionStorage.setItem("refresh_token", tokens.refresh_token);
              return tokens.access_token;
            })
            .finally(() => {
              refreshRequest = null;
            });
        }
        const access_token = await refreshRequest;

        // Update header and retry request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
