output "vpc_id" {
  value = try(module.vpc[0].vpc_id, null)
}

output "public_subnet_ids" {
  value = try(module.vpc[0].public_subnets, [])
}

output "private_subnet_ids" {
  value = try(module.vpc[0].private_subnets, [])
}