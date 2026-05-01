# Monitoring Notes

## Implemented monitoring

- CloudWatch logs for the deployed AWS components
- CloudWatch dashboard for the dev environment
- CloudWatch alarms for key services

## Monitored areas

- public ALB health and error rates
- RDS PostgreSQL health metrics
- ElastiCache Redis health metrics
- Lambda errors and execution metrics
- SQS queue depth and DLQ activity

## Demo evidence

During review, the main monitoring evidence is:

- CloudWatch dashboard
- Lambda log group for invoice generation
- SQS metrics
- ALB and target health views

## Notes

- Monitoring is intentionally lightweight and focused on the deployed architecture
- Prometheus and Grafana were not added because CloudWatch was enough for the course scope and lower risk for the deadline
