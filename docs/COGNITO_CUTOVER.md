# Cognito Cutover Guide

ShopCloud supports two frontend authentication modes:

- `NEXT_PUBLIC_AUTH_MODE=local` is the current default. The UI uses the
  local FastAPI auth service and local JWTs.
- `NEXT_PUBLIC_AUTH_MODE=cognito` redirects users to Cognito Hosted UI,
  completes the OAuth authorization-code flow with PKCE, and sends a
  Cognito ID token to backend services.

The feature flag keeps the current demo path safe: the Cognito code can
be merged without changing live behavior.

## Current User Pools

- Customer pool: `us-east-1_ML4GVS8pk`
- Admin pool: `us-east-1_UullAvJJ1`
- Region: `us-east-1`

## Customer Cognito Settings

Use the customer user pool app client.

- Hosted UI domain prefix: `shopcloud-dev-customers`
- Hosted UI domain: `shopcloud-dev-customers.auth.us-east-1.amazoncognito.com`
- User pool ID: `us-east-1_ML4GVS8pk`
- App client ID: `s6uarb38gsig7gvdpd23v9e5t`
- Callback URLs:
  - `https://www.shopcloud312.com/auth/callback`
  - `https://dia46ciw5njau.cloudfront.net/auth/callback`
- Sign-out URLs:
  - `https://www.shopcloud312.com`
  - `https://dia46ciw5njau.cloudfront.net`
- OAuth flow: Authorization code grant
- PKCE: enabled by the frontend
- Scopes: `openid`, `email`, `profile`
- Client secret: none

Status: configured in AWS. Kubernetes activation is staged separately so
the working public demo can be rolled forward or back cleanly.

## Admin Cognito Settings

The admin user pool exists, but the current private admin URL is HTTP:

`http://internal-k8s-internaladmin-50c598b1ca-1815347815.us-east-1.elb.amazonaws.com/`

Amazon Cognito Hosted UI requires HTTPS callback URLs except localhost.
Because of that, this internal HTTP ALB URL cannot be used directly as a
Cognito callback URL.

Safest admin options:

1. Keep admin on local/demo auth for the final demo.
2. Add an HTTPS internal admin DNS name later, for example
   `https://admin.shopcloud312.com`, backed by the internal ALB and
   reachable only through VPN.
3. For local-only testing, use a localhost callback URL with port
   forwarding, but do not present that as the final architecture.

If the HTTPS internal admin URL is created later, use:

- Hosted UI domain prefix: `shopcloud-dev-admins`
- Hosted UI domain: `shopcloud-dev-admins.auth.us-east-1.amazoncognito.com`
- Callback URL: `https://admin.shopcloud312.com/auth/callback`
- Sign-out URL: `https://admin.shopcloud312.com`
- OAuth flow: Authorization code grant
- PKCE: enabled by the frontend
- Scopes: `openid`, `email`, `profile`
- Client secret: none

## Kubernetes Configuration For Customer Cutover

The dev overlay contains customer-only activation patches:

- `patch-customer-cognito-env.yaml` enables Cognito only for
  `customer-web`.
- `patch-catalog-cognito-env.yaml`, `patch-cart-cognito-env.yaml`, and
  `patch-checkout-cognito-env.yaml` enable Cognito JWT verification only
  on customer-facing APIs.
- Admin remains on local/demo auth because its current private ALB URL is
  HTTP, and Cognito Hosted UI callbacks require HTTPS except localhost.

The customer frontend values are:

```yaml
NEXT_PUBLIC_AUTH_MODE: "cognito"
NEXT_PUBLIC_COGNITO_REGION: "us-east-1"
NEXT_PUBLIC_COGNITO_CUSTOMER_DOMAIN: "shopcloud-dev-customers"
NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID: "s6uarb38gsig7gvdpd23v9e5t"
NEXT_PUBLIC_COGNITO_CUSTOMER_REDIRECT_URI: "https://www.shopcloud312.com/auth/callback"
```

For customer-facing backend JWT verification, set:

```yaml
JWT_VERIFIER: "cognito"
COGNITO_REGION: "us-east-1"
COGNITO_CUSTOMER_POOL_ID: "us-east-1_ML4GVS8pk"
COGNITO_CUSTOMER_CLIENT_ID: "s6uarb38gsig7gvdpd23v9e5t"
COGNITO_ADMIN_POOL_ID: "us-east-1_UullAvJJ1"
COGNITO_ADMIN_CLIENT_ID: "admin-local-not-enabled"
```

## Demo Users

Create one user in each pool:

- Customer demo user: `mmh173@mail.aub.edu`
- Admin demo user: `admin@shopcloud.example` or another verified admin
  email you can access

For SES sandbox invoice email, the customer checkout email must still be
verified in SES.

## Rebuilds Needed

- Customer Cognito only: rebuild and roll out `customer-web`; restart
  `catalog`, `cart`, and `checkout` with their Cognito verifier env
  patches.
- Admin Cognito later: rebuild and roll out `admin-web` after an HTTPS
  private admin URL exists.
- Auth service does not need a rebuild for Hosted UI because Cognito
  issues the tokens.

## Rollback

1. Set `NEXT_PUBLIC_AUTH_MODE=local`.
2. Set `JWT_VERIFIER=local` if backend verification was changed.
3. Redeploy the previous frontend image tag.
4. Restart affected pods.

This returns the app to the known working local/demo auth path.
