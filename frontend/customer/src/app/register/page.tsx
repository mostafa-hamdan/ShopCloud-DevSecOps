"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  confirmCustomerSignup,
  resendCustomerSignupCode,
  signUpCustomer,
} from "@/lib/cognito";

export default function RegisterPage() {
  const { register, authMode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  if (authMode === "cognito") {
    async function submitCognito(e: React.FormEvent) {
      e.preventDefault();
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await signUpCustomer(email.trim(), password, fullName.trim());
        if (result.userConfirmed) {
          router.push("/login");
          return;
        }
        setAwaitingConfirmation(true);
        setNotice(
          result.destination
            ? `Verification code sent to ${result.destination}.`
            : "Verification code sent to your email.",
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      } finally {
        setBusy(false);
      }
    }

    async function submitConfirmation(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await confirmCustomerSignup(email.trim(), confirmationCode.trim());
        router.push("/login");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to confirm account");
      } finally {
        setBusy(false);
      }
    }

    async function resendCode() {
      setBusy(true);
      setError(null);
      try {
        await resendCustomerSignupCode(email.trim());
        setNotice("A new verification code has been sent.");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to resend code");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="max-w-md mx-auto bg-white border border-black/10 rounded p-6">
        <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
        <p className="text-sm text-black/60 mb-5">
          Customer sign-up uses Amazon Cognito with email verification.
        </p>
        {!awaitingConfirmation ? (
          <form onSubmit={submitCognito} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-black/50 mt-1">
                Use at least 8 characters with upper, lower, number, and symbol.
              </p>
            </div>
            {notice && <p className="text-emerald-700 text-sm">{notice}</p>}
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
            >
              {busy ? "Creating..." : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitConfirmation} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" htmlFor="code">Verification code</label>
              <input
                id="code"
                type="text"
                required
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
              />
            </div>
            {notice && <p className="text-emerald-700 text-sm">{notice}</p>}
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
            >
              {busy ? "Confirming..." : "Confirm account"}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={busy}
              className="w-full px-4 py-2.5 border border-black/15 rounded hover:border-black/30 disabled:bg-black/5"
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email, password, fullName);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-black/10 rounded p-6">
      <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
      <p className="text-sm text-black/60 mb-5">
        Already have one?{" "}
        <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-black/50 mt-1">Minimum 8 characters.</p>
        </div>
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full px-4 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
