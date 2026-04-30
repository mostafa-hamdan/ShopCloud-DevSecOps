# AWS Stage 1 and Stage 2 Checklist

No AWS provisioning should start until this checklist is reviewed and approved.

Turn on VPN before Terraform commands.

## Stage 1: AWS prerequisites

### PowerShell checks
```powershell
aws --version
aws configure list-profiles
aws sts get-caller-identity --profile <profile-name>
aws configure get region --profile <profile-name>
```

If the configured region is not `us-east-1`, set it:
```powershell
aws configure set region us-east-1 --profile <profile-name>
```

Current verified local default from this machine:

- AWS CLI: installed
- Profile discovered: `default`
- Region for `default`: `us-east-1`
- Account ID returned by STS: confirm with the project owner before use
- Current credential ARN looked like root credentials; prefer an IAM user/role for actual provisioning

### SES verification plan
- Verify one sender email for invoices.
- Verify one recipient email if the account remains in SES sandbox.
- Keep SES sandbox limitations in the demo plan unless production access is approved.

Commands to run only after approval:

```powershell
$env:AWS_PROFILE = "<profile-name>"
$env:AWS_REGION = "us-east-1"
$SENDER_EMAIL = "<sender@example.com>"
$RECIPIENT_EMAIL = "<recipient@example.com>"

aws sesv2 create-email-identity --email-identity $SENDER_EMAIL --region $env:AWS_REGION --profile $env:AWS_PROFILE
aws sesv2 create-email-identity --email-identity $RECIPIENT_EMAIL --region $env:AWS_REGION --profile $env:AWS_PROFILE
```

### Cognito plan
- Customer user pool:
  - used by customer storefront
  - JWT consumed by customer-facing services
- Admin user pool:
  - used by admin dashboard
  - MFA enabled where feasible
  - later protected by Client VPN and internal ALB

CLI option to run only after approval:

```powershell
$env:AWS_PROFILE = "<profile-name>"
$env:AWS_REGION = "us-east-1"

aws cognito-idp create-user-pool `
  --pool-name shopcloud-dev-customers `
  --auto-verified-attributes email `
  --mfa-configuration OFF `
  --region $env:AWS_REGION `
  --profile $env:AWS_PROFILE

aws cognito-idp create-user-pool `
  --pool-name shopcloud-dev-admins `
  --auto-verified-attributes email `
  --mfa-configuration OPTIONAL `
  --software-token-mfa-configuration Enabled=true `
  --region $env:AWS_REGION `
  --profile $env:AWS_PROFILE
```

Terraform option to run only after approval:

```powershell
cd "infra\terraform\envs\dev"
# Turn on VPN before Terraform commands.
terraform init
terraform plan -var="enable_cognito=true"
```

Do not run `terraform apply` until the plan is reviewed.

### Secrets, SSM, and KMS baseline
- Secrets Manager:
  - database connection string
  - Redis auth/config if needed
  - SES sender config if sensitive
- SSM Parameter Store:
  - non-sensitive service URLs
  - environment names
  - feature flags
- KMS:
  - use AWS-managed keys first unless a customer-managed key is required for grading

Baseline command examples to run only after approval:

```powershell
$env:AWS_PROFILE = "<profile-name>"
$env:AWS_REGION = "us-east-1"

aws ssm put-parameter `
  --name "/shopcloud/dev/app-env" `
  --type String `
  --value "dev" `
  --region $env:AWS_REGION `
  --profile $env:AWS_PROFILE

aws secretsmanager create-secret `
  --name "/shopcloud/dev/database-url" `
  --description "ShopCloud dev database URL placeholder; replace after RDS is created" `
  --secret-string "replace-after-rds" `
  --region $env:AWS_REGION `
  --profile $env:AWS_PROFILE
```

KMS default: start with AWS-managed keys and defer customer-managed KMS keys unless the rubric requires them.

### GitHub secrets for later stages
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION=us-east-1`
- `ECR_REGISTRY`
- `EKS_CLUSTER_NAME`
- `KUBE_NAMESPACE=shopcloud`

### Cost warning
- Stage 1 should be low cost if we keep it to identity, verification, and configuration.
- Avoid enabling EKS, RDS, Redis, Client VPN, WAF, or NAT in this stage.

### Approval checkpoint
Before Stage 1, approve:
- AWS profile name
- AWS account ID from `sts get-caller-identity`
- SES emails to verify
- whether Cognito should be created now or deferred until after ECR

## Stage 2: ECR and image push

### ECR repositories needed
- `shopcloud/dev/frontend`
- `shopcloud/dev/catalog`
- `shopcloud/dev/cart`
- `shopcloud/dev/checkout`
- `shopcloud/dev/auth`
- `shopcloud/dev/admin`
- `shopcloud/dev/invoice-generator`

Stage 3 note: after the Next.js frontend split, the public customer app is built from
`frontend/customer/Dockerfile` and pushed to the existing `shopcloud/dev/frontend`
repository. The admin web image is deferred until the private admin path stage.

Commands to create repositories only after approval:

```powershell
$env:AWS_PROFILE = "<profile-name>"
$env:AWS_REGION = "us-east-1"

$repos = @(
  "shopcloud/dev/frontend",
  "shopcloud/dev/catalog",
  "shopcloud/dev/cart",
  "shopcloud/dev/checkout",
  "shopcloud/dev/auth",
  "shopcloud/dev/admin",
  "shopcloud/dev/invoice-generator"
)

foreach ($repo in $repos) {
  aws ecr create-repository `
    --repository-name $repo `
    --image-scanning-configuration scanOnPush=true `
    --encryption-configuration encryptionType=AES256 `
    --region $env:AWS_REGION `
    --profile $env:AWS_PROFILE
}
```

### Image tagging strategy
- Primary immutable tag: Git commit SHA
- Optional convenience tag: `dev-latest`
- Example: `<account>.dkr.ecr.us-east-1.amazonaws.com/shopcloud/dev/catalog:<commit-sha>`

### Manual PowerShell build and push outline
```powershell
$env:AWS_PROFILE = "<profile-name>"
$env:AWS_REGION = "us-east-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text --profile $env:AWS_PROFILE
$ECR = "$ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com"

aws ecr get-login-password --region $env:AWS_REGION --profile $env:AWS_PROFILE | docker login --username AWS --password-stdin $ECR

$SHA = git rev-parse --short HEAD
docker build -f frontend/customer/Dockerfile -t "$ECR/shopcloud/dev/frontend:$SHA" .
docker push "$ECR/shopcloud/dev/frontend:$SHA"
```

Repeat the build/push pattern for:

```powershell
$images = @(
  @{ Name = "customer-web"; Dockerfile = "frontend/customer/Dockerfile"; Repo = "shopcloud/dev/frontend" },
  @{ Name = "catalog"; Dockerfile = "services/catalog/Dockerfile"; Repo = "shopcloud/dev/catalog" },
  @{ Name = "cart"; Dockerfile = "services/cart/Dockerfile"; Repo = "shopcloud/dev/cart" },
  @{ Name = "checkout"; Dockerfile = "services/checkout/Dockerfile"; Repo = "shopcloud/dev/checkout" },
  @{ Name = "auth"; Dockerfile = "services/auth/Dockerfile"; Repo = "shopcloud/dev/auth" },
  @{ Name = "admin"; Dockerfile = "services/admin/Dockerfile"; Repo = "shopcloud/dev/admin" },
  @{ Name = "invoice-worker"; Dockerfile = "services/invoice-worker/Dockerfile"; Repo = "shopcloud/dev/invoice-generator" }
)

foreach ($image in $images) {
  $tag = "$ECR/$($image.Repo):$SHA"
  docker build -f $image.Dockerfile -t $tag .
  docker tag $tag "$ECR/$($image.Repo):dev-latest"
  docker push $tag
  docker push "$ECR/$($image.Repo):dev-latest"
}
```

### GitHub Actions secrets needed
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REGISTRY`

### Cost warning
- ECR storage is usually low cost, but images should still be pruned after demo if the account is no longer used.
- Do not create EKS just to test ECR.

### Approval checkpoint
Before Stage 2, approve:
- exact ECR repository names
- whether to create all repositories at once or only the six app images first
- whether GitHub Actions should push images or we should push manually first
