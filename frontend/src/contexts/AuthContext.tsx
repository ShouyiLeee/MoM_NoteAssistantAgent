import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  storeToken,
  getToken,
  clearToken,
  decodeToken,
  isTokenExpired,
  type JwtPayload,
} from "@/lib/auth";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInterviewee: boolean;
  isInterviewer: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const res = await api.get<AuthUser>("/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(res.data);
    } catch {
      // Token invalid — clear it
      clearToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  // On mount: restore session from localStorage
  useEffect(() => {
    const stored = getToken();
    if (stored && !isTokenExpired(stored)) {
      setToken(stored);
      // Set axios default header immediately
      api.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
      fetchUser(stored).finally(() => setIsLoading(false));
    } else {
      clearToken();
      setIsLoading(false);
    }
  }, [fetchUser]);

  const login = useCallback((newToken: string) => {
    storeToken(newToken);
    setToken(newToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    fetchUser(newToken);
  }, [fetchUser]);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) await fetchUser(token);
  }, [token, fetchUser]);

  const roles = user?.roles ?? [];

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isInterviewee: roles.includes("interviewee"),
        isInterviewer: roles.includes("interviewer"),
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
