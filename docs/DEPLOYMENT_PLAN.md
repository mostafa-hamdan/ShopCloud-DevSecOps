# Deployment Plan

Turn on VPN before Terraform commands.

No AWS provisioning should happen without explicit approval for the current stage.

## Stage 0: Local validation
- Create: nothing in AWS
- Cost risk: low
- Defer: none
- Approval checkpoint: already complete
- Status: Docker Compose and integration tests are the source of truth before cloud rollout

## Stage 1: AWS prerequisites
- Create:
  - AWS CLI/profile confirmation
  - SES verified identities
  - optional Cognito customer/admin pools
  - baseline Secrets Manager / SSM / KMS plan
- Cost risk: low
- Defer:
  - Cognito can be deferred until EKS app integration if time is tight
  - customer-managed KMS keys can be deferred in favor of AWS-managed keys
- Approval checkpoint: approve account ID, profile name, SES emails, and whether Cognito is created now

## Stage 2: ECR and image push
- Create:
  - ECR repos for frontend, catalog, cart, checkout, auth, admin, invoice-generator
  - image tags based on Git commit SHA
  - optional GitHub Actions push workflow
- Cost risk: low
- Defer:
  - invoice-generator ECR can be deferred if Lambda zip packaging is used first
  - GitHub automated push can be deferred in favor of manual first push
- Approval checkpoint: approve ECR repo names and manual vs GitHub Actions push

## Stage 3: VPC, EKS, AWS Load Balancer Controller, and public ALB ingress
- Create:
  - VPC/subnets/security groups
  - EKS cluster and managed node group
  - IAM OIDC provider and IRSA baseline
  - AWS Load Balancer Controller
  - public ALB ingress for customer path
- Cost risk: high
- Defer:
  - NAT Gateway if not immediately required
  - extra node groups
  - production environment
- Approval checkpoint: approve estimated EKS, node, ALB, and networking cost before any Terraform apply

## Stage 4: RDS and Redis integration
- Create:
  - RDS PostgreSQL
  - ElastiCache Redis
  - private subnet groups and security groups
  - Secrets Manager values consumed by pods
- Cost risk: medium
- Defer:
  - RDS Multi-AZ
  - Redis Multi-AZ
  - cross-region read replica
- Approval checkpoint: approve DB/cache instance sizes, single-AZ vs Multi-AZ, and destroy-after-demo plan

## Stage 5: SQS, Lambda, S3, and SES invoice pipeline
- Create:
  - SQS invoice queue
  - DLQ if stable
  - Lambda invoice generator
  - S3 invoice bucket with public access blocked
  - SES sender/recipient configuration
- Cost risk: low to medium
- Defer:
  - DLQ alarms if monitoring is not ready
  - SES production access request
- Approval checkpoint: approve SES identities, bucket name, queue names, and Lambda packaging approach

## Stage 6: Internal ALB and Client VPN private admin path
- Create:
  - internal ALB ingress
  - Client VPN endpoint
  - certificate-based auth
  - admin Cognito MFA wiring if feasible
- Cost risk: medium
- Defer:
  - Client VPN until public app and data layer are stable
  - MFA polish until Cognito basics work
- Approval checkpoint: approve certificate plan, VPN cost, and internal DNS approach

## Stage 7: CloudFront, WAF, and Route 53
- Create:
  - CloudFront distribution
  - WAF web ACL
  - Route 53 records and latency-based routing story
- Cost risk: medium
- Defer:
  - custom domain if no hosted zone is ready
  - latency routing until one endpoint is stable
  - strict WAF rules beyond managed baseline
- Approval checkpoint: approve domain/hosted zone details, WAF scope, and whether this is demo-only

## Stage 8: CloudWatch monitoring and security polish
- Create:
  - CloudWatch dashboard
  - alarms for ALB, RDS, Lambda, SQS depth, and DLQ
  - image scanning evidence
  - final hardening notes
- Cost risk: low to medium
- Defer:
  - Prometheus/Grafana
  - KEDA
  - NetworkPolicy
- Approval checkpoint: approve alarm list and dashboard scope