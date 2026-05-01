# Security Notes

## Public path

- Public customer traffic uses Route 53, CloudFront, AWS WAF, and the public ALB
- Customer sign-in uses Amazon Cognito
- Backend services validate Cognito JWTs for customer-facing APIs

## Private admin path

- Admin traffic is separated from the public path
- Admin UI is reachable only through AWS Client VPN and the internal ALB
- Admin Cognito pool exists, but Hosted UI cutover is staged because the private callback currently uses HTTP
- Admin operations still require app-level authentication

## Workload and data security

- RDS PostgreSQL is private
- ElastiCache Redis is private
- S3 invoice bucket blocks public access
- Checkout publishes invoice events through SQS using IAM-based access
- Lambda reads from SQS, writes to S3, and sends email through SES

## Secrets and config

- Local secrets are kept out of Git
- Terraform state and provider caches are excluded from the repository
- Secrets Manager / SSM / KMS are represented in the infrastructure plan
- Kubernetes manifests use secret references instead of committing live cloud secrets

## Additional controls

- Readiness and liveness probes in Kubernetes manifests
- Resource requests and limits in the workload manifests
- GitHub Actions pipeline for CI and validation
- Trivy scan workflow for repository/image security checks

## Known limitations

- SES sandbox still limits invoice delivery to verified recipient emails
- Admin Cognito cutover needs an HTTPS private callback URL
