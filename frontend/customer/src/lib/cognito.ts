// Cognito Hosted UI integration.
//
// Activated when NEXT_PUBLIC_AUTH_MODE=cognito. The flow is the
// standard OAuth 2.0 Authorization Code with PKCE:
//
//   1. /login renders a "Sign in with Cognito" button.
//   2. Button redirects the browser to the Hosted UI's /authorize URL
//      with response_type=code and a PKCE challenge derived from a
//      random verifier we stash in sessionStorage.
//   3. Cognito authenticates the user and redirects back to
//      /auth/callback?code=...
//   4. The callback page POSTs the code + verifier to /oauth2/token
//      and gets back an id_token, access_token, refresh_token.
//   5. We store the access_token in localStorage like the local flow,
//      so the rest of the app doesn't have to change.
//
// All of this is no-op when AUTH_MODE != cognito.

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION;
const POOL_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_DOMAIN;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_REDIRECT_URI;

const PKCE_VERIFIER_KEY = "shopcloud.cognito.customer.pkce";

export function isCognitoMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "cognito";
}

export function customerCognitoConfigured(): boolean {
  return Boolean(REGION && POOL_DOMAIN && CLIENT_ID && REDIRECT_URI);
}

/** Build the Hosted UI authorize URL with PKCE. Returns the URL the
 * browser should be redirected to, after stashing the PKCE verifier
 * in sessionStorage so the callback can use it. */
export async function startCustomerLogin(): Promise<string> {
  if (!customerCognitoConfigured()) {
    throw new Error("Cognito is not configured for the customer app.");
  }

  const verifier = generatePkceVerifier();
  const challenge = await pkceChallengeFromVerifier(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: REDIRECT_URI!,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return `https://${POOL_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/authorize?${params}`;
}

/** Exchange the authorization code returned by Cognito for tokens. */
export async function exchangeCustomerCode(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  if (!customerCognitoConfigured()) {
    throw new Error("Cognito is not configured for the customer app.");
  }
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing PKCE verifier — did you start the login from /login?");
  }
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID!,
    code,
    redirect_uri: REDIRECT_URI!,
    code_verifier: verifier,
  });

  const res = await fetch(
    `https://${POOL_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.error_description || j.error || JSON.stringify(j);
    } catch { /* ignore */ }
    throw new Error(`Token exchange failed: ${detail}`);
  }

  return res.json();
}

/** Send the user to Hosted UI's logout endpoint. After logout Cognito
 * redirects back to REDIRECT_URI (or the closest configured logout URL).
 * We don't strictly need this — clearing localStorage works for our SPA —
 * but it tears down the Cognito session cookie too. */
export function cognitoLogoutUrl(): string | null {
  if (!customerCognitoConfigured()) return null;
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    logout_uri: REDIRECT_URI!.replace("/auth/callback", ""),
  });
  return `https://${POOL_DOMAIN}.auth.${REGION}.amazoncognito.com/logout?${params}`;
}

/** Decode an id_token (JWT) for display purposes only. We do NOT
 * verify the signature here — the backend verifies on every API call.
 * This is just so we can read the email/sub for the UI. */
export function decodeIdToken(idToken: string): {
  sub: string;
  email: string;
  exp: number;
} {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("malformed id_token");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const claims = JSON.parse(json);
  return {
    sub: claims.sub,
    email: claims.email || claims["cognito:username"] || "",
    exp: claims.exp,
  };
}

// ---------- PKCE helpers ----------

function generatePkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(buf));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
