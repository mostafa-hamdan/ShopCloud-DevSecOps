# Demo Script

## Main URLs

- Public storefront: `https://www.shopcloud312.com`
- CloudFront fallback: `https://dia46ciw5njau.cloudfront.net`
- Private admin UI: internal ALB through AWS Client VPN

## Suggested demo order

1. Open `https://www.shopcloud312.com`.
2. Show customer sign-up and sign-in with Cognito.
3. Browse products, filter, open a product page, add to wishlist, then add to cart.
4. Check out using `mmh173@mail.aub.edu` to demonstrate invoice email delivery in SES sandbox.
5. Show the generated invoice in S3.
6. Show SQS queue and Lambda logs for the invoice flow.
7. Show the CloudWatch dashboard and alarms.
8. Connect through AWS Client VPN and open the private admin UI.
9. Show product/order management in the admin panel.
10. Show the GitHub Actions workflows and recent logs.

## Demo notes

- Customer authentication is live on Cognito.
- Admin Cognito pool exists, but admin login remains on the VPN-protected private path because the current callback URL is HTTP.
- SES is still in sandbox, so invoice email delivery only works for verified recipient emails.
