# COST_NOTES

All cloud creation remains deferred until explicit approval.

| Service | Purpose | Cost risk | Cheaper alternative | When to create | Can destroy after demo? |
| --- | --- | --- | --- | --- | --- |
| Amazon ECR | Store application images for EKS deployments | Low | Local Docker images only | Stage 2 | No |
| Amazon EKS | Required managed Kubernetes platform | Medium to High | Docker Compose only during local phase | Stage 3 | Yes |
| NAT Gateway | Private subnet egress for cloud workloads | High for its value in short demos | Keep disabled at first if architecture/staging allows | Stage 3 or 4 only if truly needed | Yes |
| Public ALB | Public ingress into EKS | Medium | None for final architecture | Stage 3 | Yes |
| Internal ALB | Private admin ingress into EKS | Medium | Defer until admin path is ready | Stage 6 | Yes |
| Route 53 | DNS and latency-based routing | Low to Medium | Start without custom DNS | Stage 7 | Yes |
| CloudFront | Global distribution and performance story | Medium | Direct ALB access during early testing | Stage 7 | Yes |
| AWS WAF | Public path protection | Medium | Defer until public ingress is stable | Stage 7 | Yes |
| AWS Shield Standard | Included baseline protection | Low | N/A | Stage 7 | No |
| VPC and subnets | Foundation for all private cloud resources | Medium | Minimal single-environment design | Stage 3 | Partially |
| RDS PostgreSQL | Required transactional database | Medium | Local Postgres only before cloud | Stage 4 | Yes |
| RDS Multi-AZ | HA requirement for final architecture | Higher | Single-AZ first for the first live cut | Later after approval | Yes |
| Cross-region read replica | DR and architecture bonus | Higher | Document first, defer implementation | Last or optional | Yes |
| ElastiCache Redis | Required managed cache/cart layer | Medium | Local Redis only before cloud | Stage 4 | Yes |
| Redis Multi-AZ | HA for cache layer | Higher | Single-node/cheaper setup first | Later after approval | Yes |
| S3 | Store invoice PDFs and artifacts | Low | Local filesystem during MVP | Stage 5 | Yes |
| SQS | Async checkout event queue | Low | Local file-based event handoff | Stage 5 | Yes |
| DLQ | Capture failed invoice events | Low | Manual retries only | Stage 5 if stable | Yes |
| Lambda | Invoice generation worker | Low | Local invoice worker | Stage 5 | Yes |
| SES | Send invoice emails | Low to Medium | Local outbox mock | Stage 5 | Yes |
| Cognito customer pool | Customer auth and JWT issuance | Low to Medium | Local demo auth until cloud | Stage 1 or 4 | Yes |
| Cognito admin pool | Separate admin auth with MFA | Low to Medium | Local demo auth until cloud | Stage 1 or 6 | Yes |
| AWS Client VPN | Required private admin path | Medium | Defer until public path is stable | Stage 6 | Yes |
| Secrets Manager | Store sensitive application secrets | Low to Medium | Temporary local env files only for local dev | Stage 1 | No |
| SSM Parameter Store | Store non-secret config | Low | Local config files only during MVP | Stage 1 | No |
| KMS | Encrypt data and secrets | Low to Medium | AWS-managed keys where acceptable | Stage 1 or 4 | No |
| CloudWatch | Logs, metrics, alarms, and dashboard | Low to Medium | Minimal default logs only | Stage 8 | No |
| Trivy in CI | Image and filesystem scanning | Low | Skip until CI is stable | After CI baseline | No |

## Cost-sensitive defaults
- Default AWS region: `us-east-1`
- First live environment only: `dev`
- Defer `prod`, Multi-AZ, Client VPN, WAF, CloudFront, and Route 53 until the application path is stable
- Always review the cheaper alternative before provisioning any medium or high cost item