# Security Plan

## Current local protections
- No real secrets committed to git
- Demo auth separated between customer and admin roles
- Local-only values remain in env files or Compose config

## Cloud security goals
- Separate Cognito pools for customers and admins
- Admin MFA when Cognito is enabled
- Private admin path through Client VPN and internal ALB
- No public RDS
- No public Redis
- S3 block public access
- Least-privilege IAM and security groups
- IRSA for workload access to AWS services
- Secrets Manager for sensitive values
- SSM Parameter Store for non-secret config
- KMS-backed encryption where appropriate

## Container and Kubernetes hardening
- Non-secret config in ConfigMaps
- Secret references in deployments, not inline secrets
- Resource requests and limits
- Readiness and liveness probes
- Keep image scan support ready in CI

## Deferred but planned
- Client VPN creation after ACM certificate material is ready
- Trivy in CI if the baseline pipelines are stable
- NetworkPolicy only if it does not add avoidable risk late in the deadline

## Current cloud status
- CloudFront and AWS WAF protect the public customer path.
- Checkout uses IRSA to publish invoice events to SQS.
- RDS and Redis are private.
- S3 invoice bucket blocks public access.
- Cognito customer/admin pools are provisioned for final architecture evidence; the live demo app remains on local JWT mode for stability.
