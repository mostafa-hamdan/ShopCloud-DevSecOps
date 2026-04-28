"use client";

import { useState } from "react";
import { useAdminAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm bg-white rounded shadow-lg p-8">
        <p className="text-xs uppercase tracking-widest text-black/50">ShopCloud</p>
        <h1 className="text-2xl font-semibold mt-1 mb-6">Admin sign in</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="e">Email</label>
            <input
              id="e"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-black/15 rounded focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="p">Password</label>
            <input
              id="p"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-black/15 rounded focus:outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-red-700 text-sm">{error}</p>}
          <button
            disabled={busy}
            className="w-full px-4 py-2.5 bg-accent text-white rounded hover:bg-blue-800 disabled:bg-black/30"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-black/50">
          Internal access only. Customer accounts cannot sign in here.
        </p>
      </div>
    </div>
  );
}
