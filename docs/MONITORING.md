# Monitoring Plan

## Local validation
- Docker Compose health checks for Postgres and Redis
- Integration tests verify service health endpoints and core flows

## AWS monitoring target
- CloudWatch logs for EKS workloads, Lambda, and ALB access logs where practical
- CloudWatch metrics and alarms for:
  - ALB 5xx and unhealthy targets
  - RDS CPU, storage, and connections
  - Redis health
  - Lambda errors and duration
  - SQS queue depth and DLQ activity

## Dashboard scope
- Keep the first dashboard simple:
  - application health summary
  - invoice pipeline health
  - database and cache health

## Alerting posture
- Prefer a few meaningful alarms over a noisy set of low-value alerts
- Keep monitoring lightweight until the live environment is stable