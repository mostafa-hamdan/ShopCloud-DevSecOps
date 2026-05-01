# Cognito Cutover Notes

## Current state

- Customer Cognito is live on the public storefront
- Customer pool: `us-east-1_ML4GVS8pk`
- Customer app client ID: `s6uarb38gsig7gvdpd23v9e5t`
- Hosted UI domain: `shopcloud-dev-customers.auth.us-east-1.amazoncognito.com`
- Public callback: `https://www.shopcloud312.com/cognito/callback`

## Customer flow

- Customer sign-up is handled from the ShopCloud registration page
- Customer sign-in uses Cognito
- Customer-facing backend services validate Cognito JWTs

## Admin state

- Admin pool exists: `us-east-1_UullAvJJ1`
- Admin Cognito Hosted UI is not active in the live demo
- Reason: the current private admin callback URL is HTTP, while Cognito Hosted UI requires HTTPS callback URLs except for localhost

## Current admin protection

- AWS Client VPN
- internal ALB
- app-level admin authentication

## What is needed for full admin Cognito cutover

- an HTTPS private admin URL
- matching callback and sign-out URLs in the admin app client
- frontend cutover for `admin-web`

## Demo note

For the final demo, customer Cognito is the active public authentication path. Admin Cognito is presented as staged but not activated because of the private HTTPS callback requirement.
