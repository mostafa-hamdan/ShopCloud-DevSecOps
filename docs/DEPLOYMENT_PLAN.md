# Deployment Plan

Turn on VPN before Terraform commands.

This project was implemented in stages to keep cost and risk under control.

## Stage 0: local validation

Completed.

- Docker Compose for the full local stack
- Local PostgreSQL and Redis
- Integration tests for the main flows

## Stage 1: AWS prerequisites

Completed.

- AWS account and CLI profile setup
- SES sender verification
- Cognito customer and admin pools
- baseline secrets/config planning

## Stage 2: ECR and image push

Completed.

- ECR repositories for the app images
- manual image build and push flow
- GitHub Actions workflow support for image automation

## Stage 3: EKS and public ingress

Completed.

- VPC and networking
- EKS cluster
- public ALB ingress
- AWS Load Balancer Controller
- public customer application on EKS

## Stage 4: managed data layer

Completed.

- Amazon RDS PostgreSQL
- Amazon ElastiCache Redis
- private connectivity from EKS workloads

## Stage 5: async invoice pipeline

Completed.

- SQS queue
- Lambda invoice generator
- S3 invoice storage
- SES invoice delivery
- DLQ support

## Stage 6: private admin path

Completed in staged form.

- internal ALB
- AWS Client VPN
- private admin UI over VPN
- admin Cognito pool created but not cut over

## Stage 7: edge and public DNS

Completed.

- Route 53 hosted zone and public record
- ACM certificate in `us-east-1`
- CloudFront distribution
- AWS WAF on the public path
- final public URL: `https://www.shopcloud312.com`

## Stage 8: monitoring and hardening

Completed for the demo environment.

- CloudWatch dashboard
- CloudWatch alarms
- GitHub Actions workflows
- Trivy scan workflow
- Cognito customer login on the public storefront

## Current limitations

- Admin Cognito Hosted UI is staged because the private admin callback currently uses HTTP
- SES is still in sandbox
- RDS and Redis are cost-aware dev deployments, not full production HA deployments
- Cross-region DR is documented but not enabled
