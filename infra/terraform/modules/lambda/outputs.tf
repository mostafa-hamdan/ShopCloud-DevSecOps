output "function_name" {
  value = try(aws_lambda_function.this[0].function_name, null)
}