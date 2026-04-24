output "primary_endpoint" {
  value = try(aws_elasticache_replication_group.this[0].primary_endpoint_address, null)
}