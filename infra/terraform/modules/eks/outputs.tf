output "cluster_name" {
  value = try(module.eks[0].cluster_name, null)
}

output "oidc_provider_arn" {
  value = try(module.eks[0].oidc_provider_arn, null)
}