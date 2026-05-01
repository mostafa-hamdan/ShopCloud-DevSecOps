# COST_NOTES

AWS resources are live in the dev environment. Keep only what is needed for the demo and clean up after grading.

| Service | Purpose | Cost risk | Cheaper alternative | Current state | Can destroy after demo? |
| --- | --- | --- | --- | --- | --- |
| Amazon ECR | Store container images | Low | Local images only | Live | No |
| Amazon EKS | Managed Kubernetes platform | Medium to High | Docker Compose only | Live | Yes |
| Public ALB | Customer ingress into EKS | Medium | None for final architecture | Live | Yes |
| Internal ALB | Private admin ingress | Medium | Defer admin path | Live | Yes |
| Route 53 | Custom DNS | Low to Medium | CloudFront default domain only | Live | Yes |
| CloudFront | Public HTTPS delivery | Medium | Direct ALB for testing only | Live | Yes |
| AWS WAF | Public path protection | Medium | None if only testing | Live | Yes |
| VPC and subnets | Base networking | Medium | None | Live | Partially |
| RDS PostgreSQL | Transactional data store | Medium | Local Postgres only | Live | Yes |
| ElastiCache Redis | Cart and wishlist cache | Medium | Local Redis only | Live | Yes |
| S3 | Invoice storage | Low | Local filesystem only | Live | Yes |
| SQS | Invoice queue | Low | Local queue only | Live | Yes |
| Lambda | Invoice processing | Low | Local worker only | Live | Yes |
| SES | Invoice email | Low | Local outbox only | Live, sandbox mode | Yes |
| Cognito customer pool | Public customer authentication | Low to Medium | Local auth only | Live | Yes |
| Cognito admin pool | Separate admin identity boundary | Low to Medium | Local admin auth only | Created, not activated | Yes |
| AWS Client VPN | Private admin access | Medium | Not acceptable for final architecture | Live | Yes |
| CloudWatch | Logs, dashboard, alarms | Low to Medium | Minimal default logs only | Live | No |

## Important cost notes

- Highest active cost items are EKS, the ALBs, RDS, Redis, CloudFront, and Client VPN.
- SES is still in sandbox, so invoice emails only reach verified recipient emails.
- The environment is intentionally a single dev environment, not a full production setup.
- RDS and Redis are deployed in cost-aware dev mode rather than full HA mode.

## Cleanup reminder

Before cleanup, review:

- `docs/ROLLBACK.md`
- current EKS workloads
- current ALBs
- RDS and Redis instances
- CloudFront and WAF resources
- Client VPN endpoint
