output "vpc_id" {
  value = module.networking.vpc_id
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "invoice_bucket" {
  value = module.s3.bucket_name
}