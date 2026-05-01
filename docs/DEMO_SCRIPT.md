# Demo Script

## Goal
Show a clean, reliable project narrative without overselling unfinished cloud work.

## Suggested demo order
1. Open the live CloudFront storefront: `https://dia46ciw5njau.cloudfront.net`.
2. Search/filter products and show product images.
3. Sign in/register with `mmh173@mail.aub.edu` if demonstrating SES email.
4. Add an item to cart and checkout.
5. Show the S3 invoice object in `shopcloud-dev-invoices-338078971311/invoices/`.
6. Show SQS queue depth at zero and Lambda logs.
7. Show CloudWatch dashboard `shopcloud-dev-dashboard`.
8. Show WAF `shopcloud-dev-public` attached to CloudFront.
9. Show Cognito customer/admin pools.
10. Show internal admin API ingress and explain Client VPN certificate dependency.
11. Show GitHub Actions CI/CD workflows.

## Demo talking points
- The app scope is intentionally small so the infrastructure story stays credible.
- Customer and admin access are already separated in the UI and service boundaries.
- Invoice flow now uses SQS, Lambda, S3, and SES in AWS.
- CI validates code, Docker builds, Terraform, and security scanning.
- CD is manual-gated for ECR push and EKS deploy.
