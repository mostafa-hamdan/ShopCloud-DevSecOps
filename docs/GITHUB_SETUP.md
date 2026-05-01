# GitHub Setup

## Create the repository
1. Create a new GitHub repository named `ShopCloud-DevSecOps`.
2. Keep it private until the project is ready to submit or share.
3. Do not initialize it with a README because this repo already has one.

## Connect the local repo
```powershell
cd "D:\AUB\EECE 798T - DEVSECOPS\Project\Phase2-3\ShopCloud-DevSecOps"
git status
git remote -v
git branch --show-current

git add .
git commit -m "chore: scaffold ShopCloud MVP infrastructure project"
git remote add origin https://github.com/<your-org-or-user>/ShopCloud-DevSecOps.git
git branch -M main
git push -u origin main

git switch -c dev
git push -u origin dev
git switch main
```

If `origin` already exists, replace the remote add command with:

```powershell
git remote set-url origin https://github.com/<your-org-or-user>/ShopCloud-DevSecOps.git
```

## Branch approach
- `main`: stable demo-ready branch.
- `dev`: integration branch for active work.
- Feature branches only when useful, for example `feature/admin-ui` or `feature/k8s-manifests`.

## Recommended first commits
For speed, one clean first commit is acceptable:

1. `chore: scaffold ShopCloud MVP infrastructure project`

If you want a more detailed history before pushing, split into:

1. `chore: scaffold ShopCloud local MVP`
2. `feat: add services frontend and invoice worker`
3. `test: add docker compose integration tests`
4. `chore: prepare terraform kubernetes and ci`
5. `docs: add deployment security monitoring and cost plans`

## Teammate contribution suggestions
- Frontend copy cleanup and screenshots.
- Demo product data and product images.
- README and demo script proofreading.
- Manual local test run and screenshots.
- Presentation slides based on the architecture docs.

## GitHub secrets needed later
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REGISTRY`
- `EKS_CLUSTER_NAME`
- `KUBE_NAMESPACE`
- `TF_VAR_project_name`
- `TF_VAR_environment`

Do not add secrets until the AWS stages are approved.

Current dev values:
- `AWS_REGION`: `us-east-1`
- `ECR_REGISTRY`: `338078971311.dkr.ecr.us-east-1.amazonaws.com`
- `EKS_CLUSTER_NAME`: `shopcloud-dev`
- `KUBE_NAMESPACE`: `shopcloud`

Keep deploy workflows manual and environment-protected for the final demo.
