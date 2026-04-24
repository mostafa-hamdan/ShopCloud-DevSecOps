output "distribution_domain_name" {
  value = try(aws_cloudfront_distribution.this[0].domain_name, null)
}