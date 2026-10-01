import React, { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/services/api";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("access_token"),
  );
  const [user, setUser] = useState(() => {
    const savedToken = sessionStorage.getItem("access_token");
    if (savedToken) {
      try {
        return jwtDecode(savedToken);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isInitializing, setIsInitializing] = useState(false);
  const parseToken = (t) => {
    try {
      const decoded = jwtDecode(t);
      setUser(decoded);
      return decoded;
    } catch (e) {
      console.error("Invalid token", e);
      logout();
      return null;
    }
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem("access_token");
    if (savedToken && !user) {
      parseToken(savedToken);
    }
  }, []);

  const isAuthenticated = !!token;
  const roles = user?.realm_access?.roles || [];
  const email = user?.email || "";

  // Treat Keycloak role matching case-insensitively; role names remain stored
  // and displayed exactly as Keycloak issues them.
  const roleSet = new Set(roles.map((role) => String(role).toUpperCase()));
  const hasRole = (role) => roleSet.has(String(role).toUpperCase());
  const hasAnyRole = (checkRoles) => checkRoles.some((r) => hasRole(r));

  const login = async (credentials) => {
    const { data } = await api.post("/auth/login", credentials);
    const { access_token, refresh_token } = data.data;

    setToken(access_token);
    sessionStorage.setItem("access_token", access_token);
    sessionStorage.setItem("refresh_token", refresh_token);

    // Return the claims as well as storing them in state.  State updates are
    // asynchronous, while the login page needs the roles immediately to pick
    // the correct first dashboard.
    return parseToken(access_token);
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      } catch (e) {
        console.error("Logout failed on server", e);
      }
    }
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isInitializing,
        isAuthenticated,
        roles,
        email,
        hasRole,
        hasAnyRole,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
