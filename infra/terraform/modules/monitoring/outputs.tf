output "dashboard_name" {
  value = try(aws_cloudwatch_dashboard.this[0].dashboard_name, null)
}