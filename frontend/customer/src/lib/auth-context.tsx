"use client";

// Lightweight auth state held in React context + localStorage.
// We deliberately do not use cookies here — the backend is fully token-
// based, and a SPA-style flow keeps the architecture cleaner.

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { auth as authApi, AuthResponse } from "./api";

type AuthState = {
  token: string | null;
  userId: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isReady: boolean;
};

const STORAGE_KEY = "shopcloud.customer.auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): AuthState {
  if (typeof window === "undefined") return { token: null, userId: null, email: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, userId: null, email: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, userId: null, email: null };
  }
}

function writeStorage(state: AuthState) {
  if (typeof window === "undefined") return;
  if (state.token) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, userId: null, email: null });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setState(readStorage());
    setIsReady(true);
  }, []);

  const apply = useCallback((r: AuthResponse) => {
    const next = { token: r.access_token, userId: r.user_id, email: r.email };
    setState(next);
    writeStorage(next);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await authApi.login(email, password);
      apply(r);
    },
    [apply],
  );

  const register = useCallback(
    async (email: string, password: string, fullName = "") => {
      const r = await authApi.register(email, password, fullName);
      apply(r);
    },
    [apply],
  );

  const logout = useCallback(() => {
    const next = { token: null, userId: null, email: null };
    setState(next);
    writeStorage(next);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
