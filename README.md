# ShopCloud

E-commerce platform for the EECE 503Q DevSecOps project.

Five FastAPI microservices, two Next.js frontends, an async invoice
worker, and the AWS infrastructure (Terraform + Kubernetes manifests)
to deploy the whole thing on EKS.

## Architecture

Customers reach the storefront over HTTPS through Route 53 → CloudFront
→ WAF → public ALB → EKS. Admins reach the panel through Client VPN →
internal ALB → the same EKS cluster, but a separate ingress.

Inside the cluster:

```
                       (internal calls; X-Internal-Key header)
       ┌─────────┐ ◄────────────────────────────────────────────┐
       │  auth   │                                              │
       └────┬────┘                                              │
            │                                                   │
            │ JWT verify (HS256 dev / Cognito RS256 prod)       │
            ▼                                                   │
   ┌─────────────────┬─────────────────┬─────────────────┐      │
   │     catalog     │      cart       │     checkout    │ ◄────┘
   │  (products,     │  (Redis cart    │  (orders,       │   admin
   │   reviews,      │   + wishlist)   │   returns)      │  (proxy)
   │   stock)        │                 │                 │
   └─────────────────┴─────────────────┴────────┬────────┘
                                                │
                                                ▼  publish
                                    SQS (or local file in dev)
                                                │
                                                ▼
                                    invoice-worker
                                    ↓ render PDF
                                    ↓ upload to S3
                                    ↓ email via SES
```

Both the auth path (HS256/Cognito) and the queue/storage/mail path
(local files / SQS+S3+SES) are env-toggle. Local dev runs everything
in containers; prod flips a few env vars to use AWS-managed services.

## Layout

```
services/
  auth/            FastAPI (port 8004) — customer + admin pools, profile, addresses
  catalog/         FastAPI (port 8001) — products, categories, reviews, atomic stock
  cart/            FastAPI (port 8002) — Redis-backed cart + wishlist
  checkout/        FastAPI (port 8003) — orders, returns, async invoice publish
  admin/           FastAPI (port 8005) — orchestration over auth/catalog/checkout
  invoice-worker/  Worker — queue consumer, PDF render, S3 upload, SES email
shared/
  pyshared/        JWT, DB, internal-key, structured logging, retry HTTP client,
                   rate limiter, queue (SQS|local), mail (SES|local)
frontend/
  customer/        Next.js storefront (port 3000)
  admin/           Next.js admin panel (port 3001)
lambda/
  invoice_generator/  AWS Lambda packaging of the invoice worker for prod
infra/terraform/
  envs/{dev,prod}/   Per-environment entrypoints
  modules/           VPC, EKS, RDS, Redis, S3, SQS, Lambda, Cognito, ECR,
                     IRSA, Client VPN, edge (CloudFront + WAF + R53), monitoring
deploy/k8s/
  base/              Deployments, Services, ConfigMap, ingresses, HPAs
  overlays/{dev,prod}  Per-environment patches
tests/
  test_auth.py, test_catalog.py, test_cart.py, test_checkout.py
                     In-process pytest suite (sqlite + fakeredis + respx)
  test_api.py        Live integration tests run against docker compose
.github/workflows/
  ci.yml, docker-build.yml, terraform-validate.yml, trivy.yml
docs/
  ARCHITECTURE.md, DEPLOYMENT_PLAN.md, AWS_STAGE_1_2_CHECKLIST.md,
  COST_NOTES.md, MONITORING.md, SECURITY.md, ROLLBACK.md
```

## Running locally

You need Docker Desktop, Node.js 20+, and Python 3.11+.

### One-time frontend setup

```powershell
# PowerShell
cd frontend\customer
npm install
cd ..\admin
npm install
cd ..\..
```

```bash
# bash / WSL / Git Bash / Linux / macOS
(cd frontend/customer && npm install)
(cd frontend/admin && npm install)
```

### Bring up the stack

```powershell
# PowerShell
Copy-Item .env.example .env   # adjust JWT_SECRET / INTERNAL_API_KEY if you like
docker compose up --build -d
```

```bash
cp .env.example .env
docker compose up --build -d
```

Service URLs:

| Service          | URL                          |
|------------------|------------------------------|
| Catalog          | http://localhost:8001        |
| Cart             | http://localhost:8002        |
| Checkout         | http://localhost:8003        |
| Auth             | http://localhost:8004        |
| Admin            | http://localhost:8005        |
| Customer web     | http://localhost:3000        |
| Admin web        | http://localhost:3001        |

Bootstrap admin login: `admin@shopcloud.example` / `admin12345`.

## Tests

### In-process (fast — runs in seconds, no docker)

```powershell
pip install -r requirements-dev.txt
pip install -e shared
foreach ($s in "auth","catalog","cart","checkout") {
  pip install -r "services\$s\requirements.txt"
}
pytest -q
```

```bash
pip install -r requirements-dev.txt
pip install -e shared/
for s in auth catalog cart checkout; do
  pip install -r services/$s/requirements.txt
done
pytest -q
```

38 tests; runs in ~12s.

### Live integration (against docker-compose'd stack)

```bash
docker compose up -d postgres redis catalog cart checkout auth admin invoice-worker
docker compose --profile test run --rm tests
```

Exercises the same flows over the network: registration, login,
add-to-cart, checkout, refund-restock, admin product creation.

## Cloud deployment (AWS)

The Terraform code is **gated** — every module defaults to `enabled = false`
so a fresh checkout costs nothing. See `docs/DEPLOYMENT_PLAN.md` for the
8-stage rollout. Read `COST_NOTES.md` before any `terraform apply`.

Current live dev environment:

| Component | Value |
| --- | --- |
| Region | `us-east-1` |
| EKS cluster | `shopcloud-dev` |
| Public HTTPS URL | `https://dia46ciw5njau.cloudfront.net` |
| Public ALB | `k8s-publicshopcloud-c9b58cfdd0-112985133.us-east-1.elb.amazonaws.com` |
| Internal admin ALB | `internal-k8s-internaladmin-50c598b1ca-1815347815.us-east-1.elb.amazonaws.com` |
| CloudWatch dashboard | `shopcloud-dev-dashboard` |
| Cognito customer pool | `us-east-1_ML4GVS8pk` |
| Cognito admin pool | `us-east-1_UullAvJJ1` |

The toggles to flip when going live:

```hcl
# infra/terraform/envs/dev/terraform.tfvars
enable_networking  = true
enable_ecr         = true
enable_eks         = true
enable_rds         = true
enable_redis       = true
enable_s3          = true
enable_sqs         = true
enable_lambda      = true
enable_cognito     = true
enable_monitoring  = true
enable_edge        = true   # CloudFront + WAF + Route 53
enable_client_vpn  = true   # admin VPN
```

Then in the prod overlay configmap, set `JWT_VERIFIER=cognito`,
`QUEUE_BACKEND=sqs`, `STORAGE_BACKEND=s3`, `MAIL_BACKEND=ses`. The
service code already handles both paths — no code change needed.

## CI/CD

GitHub Actions workflows:

| Workflow | Purpose |
| --- | --- |
| `ci.yml` | Unit tests, Compose validation, integration tests, Docker build checks |
| `terraform-validate.yml` | Terraform fmt/init/validate |
| `trivy.yml` | Filesystem vulnerability scan |
| `docker-build.yml` | Manual ECR image build/push |
| `deploy-dev.yml` | Manual EKS dev deployment |

Deployment remains manually triggered for cost control and demo stability.

## Reading order for the curious

1. `docs/ARCHITECTURE.md` — what the cloud topology looks like
2. `services/checkout/main.py` — the most complex flow (cross-service,
   atomic stock decrement, async pipeline)
3. `shared/pyshared/auth.py` — how Cognito two-pool verification works
4. `shared/pyshared/observability.py` + `http_client.py` — request-IDs
   and retry behaviour
5. `tests/test_checkout.py` — end-to-end contract tests
6. `infra/terraform/envs/dev/main.tf` — module wiring
7. `deploy/k8s/base/` — Kubernetes manifests

## Known limitations

- `pyshared.queue.LocalConsumer` is not crash-safe — it tracks
  processed message IDs in a sibling `.done` file but doesn't fsync.
  Acceptable for dev. The SQS backend uses real visibility timeouts.
- Single shared Postgres database for all services (cost-driven choice
  for dev; in prod each service can move to its own DB by changing the
  `DATABASE_URL` per service in the secrets bundle and provisioning
  more RDS instances in `infra/terraform/modules/rds/`).
- `lambda/invoice_generator/` and `services/invoice-worker/` are two
  packagings of the same logical worker — Lambda for prod, container for
  dev. Their code currently diverges; could be unified later.

## Security notes for the demo

- Bcrypt password hashing
- Constant-time internal-key comparison (`secrets.compare_digest`)
- JWT pool enforcement: a customer token can't call admin routes and
  vice versa (`tests/test_auth.py::test_admin_token_cannot_use_customer_routes`)
- Login rate-limited to 10 attempts / IP / minute
- Atomic stock decrement with `SELECT ... FOR UPDATE` row locks
  (test: `tests/test_catalog.py::test_stock_decrement_atomic`)
- Internal endpoints sit behind security groups in prod; the `X-Internal-Key`
  header is a defence-in-depth secondary control.
