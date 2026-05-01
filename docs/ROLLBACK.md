# Rollback Guidance

## Local rollback
- Stop containers:
  ```powershell
  docker compose down
  ```
- Remove data volumes only if you intentionally want a clean reset:
  ```powershell
  docker compose down -v
  ```

## GitHub Actions rollback guidance
- Keep deployment workflows manual or environment-protected at first.
- Push image and deploy steps should be separated so a failed deploy does not block CI validation.
- Keep the previously working image tag available for redeploy.
- Current dev deploy workflow is manual: `Deploy Dev To EKS`.
- Current image tags are pinned in `deploy/k8s/overlays/dev/kustomization.yaml`.

## Kubernetes rollback guidance
- Use rolling updates with readiness probes.
- Roll back a workload:
  ```powershell
  kubectl rollout undo deployment/<name> -n shopcloud
  ```
- Confirm status:
  ```powershell
  kubectl rollout status deployment/<name> -n shopcloud
  ```

## Terraform rollback guidance
Turn on VPN before Terraform commands.

- Destroy only the specific stage you intentionally created.
- Review all resources and estimated impact before any `terraform destroy`.
- Avoid destroying shared identity or DNS resources unless you are sure they are not reused.
- Current full dev cleanup starts from `infra/terraform/envs/dev` after reviewing state:
  ```powershell
  terraform destroy -var-file=".\stage6-cognito.tfvars.example"
  ```
