output "endpoint" {
  value = try(aws_db_instance.this[0].address, null)
}