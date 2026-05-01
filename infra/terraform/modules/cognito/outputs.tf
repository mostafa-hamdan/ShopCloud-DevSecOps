output "customer_user_pool_id" {
  value = try(aws_cognito_user_pool.customer[0].id, null)
}

output "customer_user_pool_client_id" {
  value = try(aws_cognito_user_pool_client.customer[0].id, null)
}

output "admin_user_pool_id" {
  value = try(aws_cognito_user_pool.admin[0].id, null)
}

output "admin_user_pool_client_id" {
  value = try(aws_cognito_user_pool_client.admin[0].id, null)
}
