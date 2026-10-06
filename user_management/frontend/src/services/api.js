import axios from "axios";
import { jwtDecode } from "jwt-decode";

let refreshRequest = null;

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

const doRefreshToken = async () => {
  const refreshToken = sessionStorage.getItem("refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh token");
  }
  if (!refreshRequest) {
    refreshRequest = axios
      .post("/api/v1/auth/refresh", { refresh_token: refreshToken })
      .then(({ data }) => {
        const tokens = data.data;
        sessionStorage.setItem("access_token", tokens.access_token);
        if (tokens.refresh_token) {
          sessionStorage.setItem("refresh_token", tokens.refresh_token);
        }
        return tokens.access_token;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

api.interceptors.request.use(async (config) => {
  const isAuthEndpoint =
    config.url?.includes("/auth/login") ||
    config.url?.includes("/auth/refresh");

  if (!isAuthEndpoint) {
    // If a refresh is currently in progress, wait for it so we don't send an expired token
    if (refreshRequest) {
      try {
        await refreshRequest;
      } catch {
        // ignore here, will fall through or fail
      }
    }

    let token = sessionStorage.getItem("access_token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Math.floor(Date.now() / 1000);
        // If token expires in less than 60 seconds, proactively refresh it before dispatching
        if (decoded.exp && decoded.exp - currentTime < 60) {
          const refreshToken = sessionStorage.getItem("refresh_token");
          if (refreshToken) {
            token = await doRefreshToken();
          }
        }
      } catch {
        // invalid token format, continue
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

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
        const access_token = await doRefreshToken();
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
