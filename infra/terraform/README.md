# Terraform Layout

Turn on VPN before Terraform commands.

## Intent
These files prepare the real infrastructure structure without running `terraform apply`.

## Environments
- `envs/dev`: first live environment when approved
- `envs/prod`: reserved structure for later

## Modules
- networking
- ecr
- eks
- rds
- redis
- s3
- sqs
- lambda
- irsa
- cognito
- monitoring
- edge
- client-vpn

## Cost posture
- All expensive modules remain disabled by default through environment variables.
- Review `COST_NOTES.md` before enabling anything medium or high cost.