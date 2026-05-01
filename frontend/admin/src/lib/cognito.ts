// Cognito Hosted UI for the admin app — same pattern as the customer
// helper, but reads the admin-pool config and uses a separate
// PKCE storage key. The admin pool has MFA enabled (mfa_configuration
// = "OPTIONAL" with TOTP) so the Hosted UI may prompt for an MFA
// code after password — our flow doesn't need to do anything special
// for that, Cognito handles it before issuing the auth code.

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION;
const POOL_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_ADMIN_DOMAIN;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_ADMIN_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_COGNITO_ADMIN_REDIRECT_URI;

const PKCE_VERIFIER_KEY = "shopcloud.cognito.admin.pkce";

export function isCognitoMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "cognito";
}

export function adminCognitoConfigured(): boolean {
  return Boolean(REGION && POOL_DOMAIN && CLIENT_ID && REDIRECT_URI);
}

export async function startAdminLogin(): Promise<string> {
  if (!adminCognitoConfigured()) {
    throw new Error("Cognito is not configured for the admin app.");
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

export async function exchangeAdminCode(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  if (!adminCognitoConfigured()) {
    throw new Error("Cognito is not configured for the admin app.");
  }
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing PKCE verifier — did you start sign-in from the login page?");
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

export function adminCognitoLogoutUrl(): string | null {
  if (!adminCognitoConfigured()) return null;
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    logout_uri: REDIRECT_URI!.replace("/auth/callback", ""),
  });
  return `https://${POOL_DOMAIN}.auth.${REGION}.amazoncognito.com/logout?${params}`;
}

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

// ---------- PKCE helpers (same as customer) ----------

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
