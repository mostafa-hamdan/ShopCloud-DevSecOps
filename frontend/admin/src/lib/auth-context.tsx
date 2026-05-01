"use client";

// Admin auth — independent of the customer storefront's context, with
// a different storage key. Mirrors the same dual-mode logic
// (local HS256 today, Cognito OAuth flag-flippable):
//
//   * "local" — POSTs to /auth/admin/login on the auth service.
//   * "cognito" — redirects to admin pool's Hosted UI.
//
// Customer JWTs cannot be used here regardless of mode — the admin
// service rejects non-admin pool tokens server-side.

import {
  createContext, useCallback, useContext, useEffect, useState, ReactNode,
} from "react";
import { adminAuth, AuthResponse } from "./api";
import {
  adminCognitoLogoutUrl, decodeIdToken, exchangeAdminCode,
  isCognitoMode, startAdminLogin,
} from "./cognito";

type AuthState = {
  token: string | null;
  userId: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => void;
  applyCognitoTokens: (idToken: string, accessToken: string) => void;
  isReady: boolean;
  authMode: "local" | "cognito";
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
  const authMode: "local" | "cognito" = isCognitoMode() ? "cognito" : "local";

  useEffect(() => {
    setState(readStorage());
    setIsReady(true);
  }, []);

  const apply = useCallback((r: AuthResponse) => {
    const next = { token: r.access_token, userId: r.user_id, email: r.email };
    setState(next);
    writeStorage(next);
  }, []);

  const applyCognitoTokens = useCallback((idToken: string, accessToken: string) => {
    const claims = decodeIdToken(idToken);
    const next = { token: accessToken, userId: claims.sub, email: claims.email };
    setState(next);
    writeStorage(next);
  }, []);

  const login = useCallback(async (email?: string, password?: string) => {
    if (authMode === "cognito") {
      const url = await startAdminLogin();
      window.location.assign(url);
      return;
    }
    if (!email || !password) {
      throw new Error("email and password are required");
    }
    const r = await adminAuth.login(email, password);
    apply(r);
  }, [apply, authMode]);

  const logout = useCallback(() => {
    const next = { token: null, userId: null, email: null };
    setState(next);
    writeStorage(next);
    if (authMode === "cognito") {
      const url = adminCognitoLogoutUrl();
      if (url) window.location.assign(url);
    }
  }, [authMode]);

  return (
    <Ctx.Provider
      value={{ ...state, login, logout, applyCognitoTokens, isReady, authMode }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth(): AuthContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth outside provider");
  return c;
}
