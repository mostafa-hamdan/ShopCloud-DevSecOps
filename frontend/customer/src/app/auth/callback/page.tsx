"use client";

// OAuth code-exchange landing page.
//
// Cognito Hosted UI redirects here after sign-in:
//    /auth/callback?code=<authcode>&state=<state>
//
// We pull the code, swap it for tokens via Cognito's /oauth2/token,
// stash the access_token in the auth context, and bounce the user
// to the homepage. If anything fails we surface the error.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { exchangeCustomerCode } from "@/lib/cognito";

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const { applyCognitoTokens } = useAuth();
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

    exchangeCustomerCode(code)
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
      <div className="max-w-md mx-auto bg-white border border-black/10 rounded p-6">
        <h1 className="text-xl font-semibold mb-2">Sign-in failed</h1>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <a href="/login" className="text-accent hover:underline text-sm">
          Try again
        </a>
      </div>
    );
  }

  return <p className="text-black/60">Signing you in…</p>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="text-black/60">Loading…</p>}>
      <Callback />
    </Suspense>
  );
}
