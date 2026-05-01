# Rollback Guidance

## Git rollback

- Use normal Git commits only
- Do not rewrite history on the submission branch
- Keep previous image tags available in ECR

## Kubernetes rollback

```powershell
kubectl rollout undo deployment/<name> -n shopcloud
kubectl rollout status deployment/<name> -n shopcloud
```

## Image rollback

- Update the image tag in `deploy/k8s/overlays/dev/kustomization.yaml`
- Re-apply the overlay
- Verify pod status and ingress health

## Cognito rollback

- Set customer frontend auth mode back to local/demo if needed
- Set customer-facing backend JWT verifier back to local/demo mode if needed
- Redeploy the previous customer image tag

## Terraform reminder

Turn on VPN before Terraform commands.

## Cost cleanup reminder

The dev environment includes EKS, ALBs, RDS, Redis, CloudFront, WAF, SQS, Lambda, S3, Cognito, and Client VPN. Review the current AWS resources carefully before any cleanup. Do not run `terraform destroy` unless the impact is fully understood.
