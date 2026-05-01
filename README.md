# ShopCloud

ShopCloud is a lightweight e-commerce platform built for a DevSecOps and Infrastructure Automation final project. The project combines a microservice-based application, containerized local development, GitHub Actions automation, Terraform infrastructure, and a live AWS deployment.

## Live deployment

- Public storefront: `https://www.shopcloud312.com`
- CloudFront domain: `https://dia46ciw5njau.cloudfront.net`
- Private admin UI: available through AWS Client VPN and the internal ALB
- GitHub repository: [mostafa-hamdan/ShopCloud-DevSecOps](https://github.com/mostafa-hamdan/ShopCloud-DevSecOps)

## Demo credentials

- Customer Cognito user: `mmh173@mail.aub.edu`
- Customer password: `ShopCloudDemo123!`
- Admin user: `admin@shopcloud.example`
- Admin password: `admin12345`

## Final architecture

Customer path:

`Route 53 -> CloudFront -> AWS WAF -> public ALB -> EKS`

Admin path:

`AWS Client VPN -> internal ALB -> EKS`

Core services in EKS:

- `catalog`: products, categories, reviews, stock
- `cart`: Redis-backed cart and wishlist
- `checkout`: orders, returns, invoice event publishing
- `auth`: local/demo auth and profile support
- `admin`: admin API over catalog/auth/checkout

Supporting AWS services:

- Amazon ECR
- Amazon EKS
- Amazon RDS PostgreSQL
- Amazon ElastiCache Redis
- Amazon SQS
- AWS Lambda
- Amazon S3
- Amazon SES
- Amazon Cognito
- Amazon CloudWatch
- Route 53, CloudFront, AWS WAF
- AWS Client VPN

## What is automated

- Dockerfiles for services and frontends
- Docker Compose for local development
- Terraform modules for the required AWS components
- Kubernetes manifests and overlays for deployment to EKS
- GitHub Actions for CI, image build/push, Terraform validation, deploy workflow, and security scanning

## How services communicate

- `customer-web` calls `catalog`, `cart`, and `checkout` through the public ingress
- `admin-web` calls the private admin API through the internal ingress
- `admin` orchestrates admin actions across `catalog`, `auth`, and `checkout`
- `cart` stores cart and wishlist state in Redis and reads product data from `catalog`
- `checkout` stores orders in PostgreSQL and publishes invoice events to SQS
- Lambda consumes SQS messages, generates PDF invoices, stores them in S3, and sends them through SES

## Authentication status

- Customer Cognito is live on the public storefront
- Admin Cognito pool exists, but Hosted UI cutover is staged because the current private admin callback URL is HTTP
- Admin access is currently protected by AWS Client VPN, the internal ALB, and app-level admin authentication

## Local development

Requirements:

- Docker Desktop
- Node.js 20+
- Python 3.11+

Start locally:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Local URLs:

- Customer web: `http://localhost:3000`
- Admin web: `http://localhost:3001`
- Catalog: `http://localhost:8001`
- Cart: `http://localhost:8002`
- Checkout: `http://localhost:8003`
- Auth: `http://localhost:8004`
- Admin API: `http://localhost:8005`

## Tests

Quick tests:

```powershell
pip install -r requirements-dev.txt
pip install -e shared
foreach ($s in "auth","catalog","cart","checkout") {
  pip install -r "services\$s\requirements.txt"
}
pytest -q
```

Docker integration tests:

```powershell
docker compose up -d postgres redis catalog cart checkout auth admin invoice-worker
docker compose --profile test run --rm tests
```

## GitHub Actions

- `ci.yml`: tests, Compose validation, Docker build checks
- `terraform-validate.yml`: `fmt`, `init`, `validate`
- `docker-build.yml`: manual ECR image build and push
- `deploy-dev.yml`: manual EKS deployment
- `trivy.yml`: scan support for the repository and images

## What remains for a fuller production setup

- Admin Cognito Hosted UI needs an HTTPS private callback URL
- SES is still in sandbox, so invoice emails only reach verified recipient emails
- RDS and Redis are deployed in cost-aware dev mode, not Multi-AZ production mode
- Cross-region disaster recovery is documented but not enabled

## Professor review map

Useful files:

- `docs/DEMO_SCRIPT.md`
- `docs/DEPLOYMENT_PLAN.md`
- `docs/SECURITY.md`
- `docs/MONITORING.md`
- `docs/ROLLBACK.md`
- `docs/COGNITO_CUTOVER.md`
- `COST_NOTES.md`

Useful implementation folders:

- `.github/workflows/`
- `infra/terraform/`
- `deploy/k8s/`
- `services/`
- `frontend/customer/`
- `frontend/admin/`

## Cleanup note

The live dev environment uses paid AWS services. Review `COST_NOTES.md` and `docs/ROLLBACK.md` before cleanup, and do not run Terraform changes without reviewing impact first.
