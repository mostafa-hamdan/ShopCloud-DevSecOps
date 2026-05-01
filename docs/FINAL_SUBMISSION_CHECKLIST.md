# Final Submission Checklist

## Moodle submission items

- GitHub repository link
- presentation slides / PPT file
- any required report or summary document
- evidence screenshots for deployment and demo flow

## GitHub repository

- Repo: [mostafa-hamdan/ShopCloud-DevSecOps](https://github.com/mostafa-hamdan/ShopCloud-DevSecOps)
- Branch for review: `main`
- GitHub Actions logs available in the repository Actions tab

## Final URLs

- Public storefront: `https://www.shopcloud312.com`
- CloudFront fallback: `https://dia46ciw5njau.cloudfront.net`
- Private admin UI: internal ALB over AWS Client VPN

## Demo flow checklist

- customer sign-up / sign-in with Cognito
- product browsing and filtering
- wishlist and cart flow
- checkout flow
- invoice generation through SQS -> Lambda -> S3 -> SES
- private admin access through VPN
- admin product/order management
- CloudWatch dashboard and alarms
- GitHub Actions workflow evidence

## Submission checks

- no `.env` files committed
- no AWS keys committed
- no Terraform state files committed
- no VPN profiles or certificate material committed
- no local runtime artifacts committed
- docs updated to match the final deployment
- Terraform, Kubernetes, Dockerfiles, and workflows preserved

## Evidence to prepare

- storefront screenshot
- Cognito login screenshot
- checkout / invoice evidence
- S3 invoice object screenshot
- CloudWatch screenshot
- private admin UI screenshot
- GitHub Actions screenshot
