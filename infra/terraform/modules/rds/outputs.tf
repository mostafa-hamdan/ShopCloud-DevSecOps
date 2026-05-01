output "endpoint" {
  value = try(aws_db_instance.this[0].address, null)
}

output "master_user_secret_arn" {
  value = try(aws_db_instance.this[0].master_user_secret[0].secret_arn, null)
}
