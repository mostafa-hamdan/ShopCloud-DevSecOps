output "vpc_id" {
  value = module.networking.vpc_id
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "invoice_bucket" {
  value = module.s3.bucket_name
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_master_user_secret_arn" {
  value     = module.rds.master_user_secret_arn
  sensitive = true
}

output "redis_primary_endpoint" {
  value = module.redis.primary_endpoint
}
