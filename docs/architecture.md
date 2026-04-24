# ShopCloud Architecture

## Local-first implementation
- React frontend with customer and admin routes
- FastAPI services for catalog, cart, checkout, auth, and admin
- PostgreSQL for products, orders, and stock
- Redis for cart state
- Local invoice worker for PDF generation and mock email output

## Final target architecture

### Public customer path
- Route 53 latency-based routing
- CloudFront
- AWS WAF + Shield
- Public ALB
- AWS Load Balancer Controller
- EKS ingress for public workloads

### Private admin path
- AWS Client VPN
- Separate admin authentication with stronger controls
- Internal ALB with no public DNS
- Separate admin ingress on the same EKS cluster

### Workload layer
- EKS hosts:
  - catalog
  - cart
  - checkout
  - auth
  - admin
- Use readiness/liveness probes, resource requests/limits, and at least two replicas where feasible after stabilization

### Identity and secret management
- Separate Cognito user pools for customers and admins
- JWT validation inside backend services
- Secrets Manager for sensitive values
- SSM Parameter Store for non-sensitive config
- KMS-backed encryption where appropriate
- IRSA for pod-to-AWS access

### Data layer
- RDS PostgreSQL
- ElastiCache Redis
- Multi-AZ and cross-region DR are deferred until core stability and cost approval

### Async invoice pipeline
- Checkout publishes to SQS
- Lambda generates invoice PDF
- PDF stored in S3
- SES sends invoice email
- DLQ included if stable and worthwhile

## Design decisions for this repo
- One real environment first, with `dev` as the primary live target
- Local Compose flow must remain working while cloud files are prepared
- No AWS provisioning until explicit approval