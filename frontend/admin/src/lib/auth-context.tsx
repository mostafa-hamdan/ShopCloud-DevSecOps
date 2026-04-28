"use client";

// Admin auth — completely independent of the customer storefront's auth
// context, with a different storage key. A customer JWT cannot be used
// here because the admin service rejects non-admin pools server-side.

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { adminAuth, AuthResponse } from "./api";

type AuthState = {
  token: string | null;
  userId: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isReady: boolean;
};

const STORAGE_KEY = "shopcloud.admin.auth";
const Ctx = createContext<AuthContextValue | null>(null);

function readStorage(): AuthState {
  if (typeof window === "undefined") return { token: null, userId: null, email: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, userId: null, email: null };
  } catch { return { token: null, userId: null, email: null }; }
}

function writeStorage(s: AuthState) {
  if (typeof window === "undefined") return;
  if (s.token) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
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

  const login = useCallback(async (email: string, password: string) => {
    const r = await adminAuth.login(email, password);
    apply(r);
  }, [apply]);

  const logout = useCallback(() => {
    const next = { token: null, userId: null, email: null };
    setState(next);
    writeStorage(next);
  }, []);

  return (
    <Ctx.Provider value={{ ...state, login, logout, isReady }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth(): AuthContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth outside provider");
  return c;
}
