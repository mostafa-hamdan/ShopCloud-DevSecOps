"use client";

// Cognito OAuth callback for the admin app — same logic as the
// customer callback, hits the admin token-exchange endpoint and
// applies the result to the admin auth context.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/lib/auth-context";
import { exchangeAdminCode } from "@/lib/cognito";

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const { applyCognitoTokens } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const oauthError = params.get("error");

    if (oauthError) {
      setError(`Cognito returned an error: ${oauthError}`);
      return;
    }
    if (!code) {
      setError("Missing authorization code.");
      return;
    }

    exchangeAdminCode(code)
      .then((tokens) => {
        applyCognitoTokens(tokens.id_token, tokens.access_token);
        router.replace("/");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Token exchange failed");
      });
  }, [params, router, applyCognitoTokens]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-sm bg-white rounded shadow-lg p-8">
          <h1 className="text-xl font-semibold mb-2">Sign-in failed</h1>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <a href="/" className="text-accent hover:underline text-sm">Try again</a>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      Signing you in…
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Loading…</div>}>
      <Callback />
    </Suspense>
  );
}
