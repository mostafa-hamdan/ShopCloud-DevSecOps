# Cognito Cutover Guide

The application supports two authentication modes, controlled by a
single environment variable on the frontend builds:

- `NEXT_PUBLIC_AUTH_MODE=local` (default, currently active)
  - Frontend posts email/password to the auth service's
    `/auth/customer/login` and `/auth/admin/login` endpoints
  - Auth service issues a short-lived HS256 JWT signed with `JWT_SECRET`
  - Backend services verify with the same `JWT_SECRET`

- `NEXT_PUBLIC_AUTH_MODE=cognito`
  - Frontend redirects to AWS Cognito Hosted UI for sign-in (and sign-up)
  - Cognito redirects back to `/auth/callback` with an authorization code
  - Frontend exchanges the code at Cognito's `/oauth2/token` endpoint
  - Resulting access_token is sent to backend services
  - Backend services verify against Cognito's JWKS via `pyshared/auth.py`

The cutover is intentionally a feature flag, not a breaking change, so
the code can be merged without changing live behaviour.

## What's already wired up (code-side)

- Customer + admin frontends both read `NEXT_PUBLIC_AUTH_MODE`
- `frontend/customer/src/lib/cognito.ts` and the admin equivalent
  implement OAuth code-flow with PKCE
- `/auth/callback` pages handle the redirect back from Cognito
- `shared/pyshared/auth.py` already supports `JWT_VERIFIER=cognito`
  with two-pool detection (customer pool vs admin pool)

## What needs to happen on AWS to flip the switch

These steps are NOT in this PR. Do them in the AWS Console (or
Terraform if a follow-up PR adds them) before flipping the env var.

### 1. Configure the Cognito user pool clients

Both pools (customer: `us-east-1_ML4GVS8pk`, admin:
`us-east-1_UullAvJJ1`) need their app clients updated:

- **Allowed callback URLs** — add the frontend's `/auth/callback`
  URL. For dev, that's:
  - Customer: `https://dia46ciw5njau.cloudfront.net/auth/callback`
  - Admin (via VPN): `http://internal-k8s-internaladmin-50c598b1ca-1815347815.us-east-1.elb.amazonaws.com/auth/callback`
- **Allowed sign-out URLs** — add the corresponding root URL of each app.
- **OAuth grants** — enable "Authorization code grant".
- **OAuth scopes** — enable `openid`, `email`, `profile`.
- **Hosted UI domain** — assign each pool a Cognito-prefixed domain
  (e.g. `shopcloud-dev-customers` and `shopcloud-dev-admins`). The
  fully-qualified domain becomes
  `<prefix>.auth.us-east-1.amazoncognito.com`.

### 2. Create one demo user in each pool

Cognito won't let anyone sign in until at least one user exists.
Either:
- Use the Cognito Console "Create user" workflow with email
  invitation, or
- Provision via `aws cognito-idp admin-create-user`

For the admin pool, set up TOTP MFA on first login (the pool has
MFA `OPTIONAL` with `software_token_mfa_configuration { enabled = true }`).

### 3. Update the dev overlay configmap and secret

Add the following to `deploy/k8s/overlays/dev/patch-configmap.yaml`:

```yaml
data:
  # Auth mode: switch from "local" to "cognito" to use Hosted UI.
  NEXT_PUBLIC_AUTH_MODE: "cognito"

  # Per-pool config (publicly visible — these are not secrets, the
  # Hosted UI URL is built from these).
  NEXT_PUBLIC_COGNITO_REGION: "us-east-1"
  NEXT_PUBLIC_COGNITO_CUSTOMER_DOMAIN: "shopcloud-dev-customers"
  NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID: "<customer-app-client-id>"
  NEXT_PUBLIC_COGNITO_CUSTOMER_REDIRECT_URI: "https://dia46ciw5njau.cloudfront.net/auth/callback"
  NEXT_PUBLIC_COGNITO_ADMIN_DOMAIN: "shopcloud-dev-admins"
  NEXT_PUBLIC_COGNITO_ADMIN_CLIENT_ID: "<admin-app-client-id>"
  NEXT_PUBLIC_COGNITO_ADMIN_REDIRECT_URI: "http://internal-k8s-internaladmin-.../auth/callback"

  # Backend verifier mode.
  JWT_VERIFIER: "cognito"
```

Add the COGNITO_* identifiers to `stage3-secret.yaml`:

```yaml
stringData:
  COGNITO_REGION: "us-east-1"
  COGNITO_CUSTOMER_POOL_ID: "us-east-1_ML4GVS8pk"
  COGNITO_CUSTOMER_CLIENT_ID: "<customer-app-client-id>"
  COGNITO_ADMIN_POOL_ID: "us-east-1_UullAvJJ1"
  COGNITO_ADMIN_CLIENT_ID: "<admin-app-client-id>"
```

### 4. Rebuild and redeploy frontends

`NEXT_PUBLIC_*` env vars are baked in at build time. After updating
the configmap, the frontend Docker images need to be rebuilt with the
new envs and pushed to ECR, then a rolling restart of the customer-web
and admin-web Deployments.

### 5. Verify

- Customer app: navigate to `/login`. Should show "Continue with
  Cognito" button. Click → redirected to Hosted UI →  enter credentials
  → redirected back to `/auth/callback` → land on homepage authenticated.
- Admin app: same flow against admin pool. MFA prompt expected.
- Hit any backend API with the obtained access_token. Backend should
  validate via JWKS and accept it.

## Rollback

If anything goes wrong:

1. Edit `patch-configmap.yaml`: set `NEXT_PUBLIC_AUTH_MODE=local`,
   `JWT_VERIFIER=local`.
2. `kubectl apply -k deploy/k8s/overlays/dev`.
3. Roll the customer-web and admin-web Deployments
   (`kubectl rollout restart deployment/customer-web` etc.).
4. The local mode flow uses the existing email/password endpoints
   which always work.

## Why we kept `local` as the default

The Cognito frontend code is verified by typecheck only. End-to-end
verification requires Cognito callback URLs, Hosted UI domains, and at
least one demo user — none of which can be set up purely from this
codebase. Shipping the cutover behind a flag means:

- Code reviewable now
- Live deployment unchanged
- Single env-var change activates Cognito once AWS-side setup is done
- Easy rollback if something goes wrong on the day
