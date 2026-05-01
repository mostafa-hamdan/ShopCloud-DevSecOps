"use client";

// Lightweight auth state held in React context + localStorage.
//
// Two modes (controlled by NEXT_PUBLIC_AUTH_MODE):
//
//   * "local" (default) — talks to the auth service's /auth/customer/login
//     and /auth/customer/register endpoints. The auth service issues a
//     short-lived HS256 JWT. This is the dev/local mode, and remains the
//     production default until the Cognito cutover is verified.
//
//   * "cognito" — login() and register() instead redirect the browser
//     to AWS Cognito Hosted UI. The /auth/callback page completes the
//     OAuth code-for-token exchange and then calls applyCognitoTokens()
//     to populate this context.
//
// The rest of the app reads `token`, `userId`, `email` regardless of
// mode, so feature pages don't need to know which auth path was taken.

import {
  createContext, useCallback, useContext, useEffect, useState, ReactNode,
} from "react";
import { auth as authApi, AuthResponse } from "./api";
import {
  decodeIdToken, exchangeCustomerCode, isCognitoMode, startCustomerLogin,
  cognitoLogoutUrl,
} from "./cognito";

type AuthState = {
  token: string | null;
  userId: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  /** Local mode: signs in with email/password.
   *  Cognito mode: redirects to Hosted UI (returns a Promise that
   *  resolves when the redirect is in flight, but the page will be
   *  replaced before that resolves in practice). */
  login: (email?: string, password?: string) => Promise<void>;
  register: (email?: string, password?: string, fullName?: string) => Promise<void>;
  logout: () => void;
  /** Cognito callback path uses this after exchanging the code. */
  applyCognitoTokens: (idToken: string, accessToken: string) => void;
  isReady: boolean;
  /** Exposed so login/register pages can render the right UI. */
  authMode: "local" | "cognito";
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

  const applyCognitoTokens = useCallback(
    (idToken: string, _accessToken: string) => {
      // The backend verifies Cognito JWTs by issuer and app-client audience.
      // Use the ID token so service-side claims include the customer email.
      const claims = decodeIdToken(idToken);
      const next = {
        token: idToken,
        userId: claims.sub,
        email: claims.email,
      };
      setState(next);
      writeStorage(next);
    },
    [],
  );

  const login = useCallback(
    async (email?: string, password?: string) => {
      if (authMode === "cognito") {
        // Redirect to Hosted UI; this function does not return.
        const url = await startCustomerLogin();
        window.location.assign(url);
        return;
      }
      if (!email || !password) {
        throw new Error("email and password are required");
      }
      const r = await authApi.login(email, password);
      apply(r);
    },
    [apply, authMode],
  );

  const register = useCallback(
    async (email?: string, password?: string, fullName = "") => {
      if (authMode === "cognito") {
        // Cognito Hosted UI handles registration via its sign-up tab.
        // We send users through the same /authorize URL — Cognito's
        // hosted UI shows "Sign up" alongside "Sign in".
        const url = await startCustomerLogin();
        window.location.assign(url);
        return;
      }
      if (!email || !password) {
        throw new Error("email and password are required");
      }
      const r = await authApi.register(email, password, fullName);
      apply(r);
    },
    [apply, authMode],
  );

  const logout = useCallback(() => {
    const next = { token: null, userId: null, email: null };
    setState(next);
    writeStorage(next);
    if (authMode === "cognito") {
      const url = cognitoLogoutUrl();
      if (url) window.location.assign(url);
    }
  }, [authMode]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, applyCognitoTokens, isReady, authMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
