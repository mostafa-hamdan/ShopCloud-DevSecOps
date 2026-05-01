"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const { login, authMode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (authMode === "cognito") {
    // In Cognito mode, login() redirects to Hosted UI. The form fields
    // are not used — Cognito captures credentials on its own page.
    async function startCognito() {
      setBusy(true); setError(null);
      try {
        await login();   // does not return; replaces the page
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start Cognito login");
        setBusy(false);
      }
    }
    return (
      <div className="max-w-md mx-auto bg-white border border-black/10 rounded p-6">
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-black/60 mb-5">
          You will be redirected to AWS Cognito to authenticate.
        </p>
        {error && <p className="text-red-700 text-sm mb-3">{error}</p>}
        <button
          onClick={startCognito}
          disabled={busy}
          className="w-full px-4 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
        >
          {busy ? "Redirecting…" : "Continue with Cognito"}
        </button>
        <p className="text-xs text-black/50 mt-4">
          New customers can register from the same Cognito sign-in page.
        </p>
      </div>
    );
  }

  // Local mode: classic email/password.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await login(email, password);
      router.push(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-black/10 rounded p-6">
      <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
      <p className="text-sm text-black/60 mb-5">
        New here?{" "}
        <Link href="/register" className="text-accent hover:underline">Create an account</Link>
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input
            id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <input
            id="password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
          />
        </div>
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full px-4 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
