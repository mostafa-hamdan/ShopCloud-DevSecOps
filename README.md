# ShopCloud

ShopCloud is a lightweight e-commerce MVP+ built for a DevSecOps / Infrastructure Automation final project. The scope stays intentionally small so the infrastructure, security, and rollout story can be real, testable, and cost-aware.

## Project overview
- React storefront with customer, cart/checkout, and admin dashboard routes
- FastAPI microservices for `catalog`, `cart`, `checkout`, `auth`, and `admin`
- PostgreSQL for products, orders, and stock
- Redis for cart state
- Local invoice worker that stands in for the future SQS + Lambda + S3 + SES pipeline
- Terraform, Kubernetes, and GitHub Actions prepared without creating AWS resources yet

## Architecture summary
- Public customer path target: Route 53 -> CloudFront -> WAF/Shield -> public ALB -> EKS ingress
- Private admin path target: Client VPN -> internal ALB -> separate admin ingress -> same EKS cluster
- Auth target: separate Cognito pools for customers and admins
- Data target: RDS PostgreSQL + ElastiCache Redis
- Async target: checkout event -> SQS -> Lambda -> S3 -> SES

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Monorepo layout
- `frontend/`: React UI
- `services/`: FastAPI services and shared helpers
- `lambda/invoice_generator/`: local-first invoice worker and future Lambda logic
- `infra/terraform/`: Terraform modules and environment entrypoints
- `deploy/k8s/`: Kubernetes base and overlays
- `docs/`: rollout, security, monitoring, rollback, and demo guidance
- `tests/`: containerized integration tests for local CI checks

## Local setup
1. Keep Docker Desktop running.
2. Open PowerShell in the project root.
3. Start the stack:
   ```powershell
   docker compose up --build -d
   ```
4. Open `http://localhost:3000`.

## Docker Compose instructions
- Start or rebuild:
  ```powershell
  docker compose up --build -d
  ```
- View container status:
  ```powershell
  docker compose ps
  ```
- Run integration tests:
  ```powershell
  docker compose --profile test run --rm tests
  ```
- Stop the stack:
  ```powershell
  docker compose down
  ```

## Service ports
- Frontend: `3000`
- Catalog: `8001`
- Cart: `8002`
- Checkout: `8003`
- Auth: `8004`
- Admin: `8005`
- PostgreSQL: `5432`
- Redis: `6379`

## Mock auth explanation
- The local MVP uses demo login endpoints from the auth service.
- Customer and admin sessions stay separate in the UI and backend checks.
- The cloud path will replace demo tokens with separate Cognito customer/admin user pools and JWT validation.

## Local invoice worker explanation
- Checkout writes an order to PostgreSQL.
- Checkout writes a local event file into `runtime/events/`.
- The invoice worker reads the event, generates a PDF into `runtime/invoices/`, and writes a mock email record into `runtime/outbox/`.
- This simulates the future SQS + Lambda + S3 + SES flow without using AWS resources yet.

## Planned AWS architecture
- One real `dev` environment first in `us-east-1`
- ECR for images, EKS for workloads, RDS for Postgres, ElastiCache for Redis
- S3, SQS, Lambda, SES for invoice delivery
- Client VPN + internal ALB for private admin access
- CloudFront + WAF + Route 53 after the application path is stable

## Terraform warning
Turn on VPN before Terraform commands.

## Cost warning
- No AWS resources are provisioned yet.
- Expensive items like EKS, NAT Gateway, RDS Multi-AZ, Redis, Client VPN, WAF, and CloudFront remain deferred until explicit approval.
- Review [COST_NOTES.md](COST_NOTES.md) before any provisioning step.

## Next cloud rollout steps
1. Prepare GitHub using [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md).
2. Review [docs/AWS_STAGE_1_2_CHECKLIST.md](docs/AWS_STAGE_1_2_CHECKLIST.md).
3. Prepare AWS credentials, SES verification, and GitHub secrets.
4. Turn on VPN before Terraform commands.
5. Stop for explicit approval before provisioning anything.