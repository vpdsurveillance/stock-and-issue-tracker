import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = user
  const [checking, setChecking] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (err) {
      // 401 on cold start is expected when no session exists.
      if (err?.response?.status && err.response.status !== 401) {
        console.error("Auth bootstrap failed:", err);
      }
      setUser(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data?.token) sessionStorage.setItem(TOKEN_KEY, data.token);
    setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout call failed (continuing):", err?.message || err);
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(false);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
