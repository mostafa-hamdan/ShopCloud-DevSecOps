variable "enabled" { type = bool }
variable "dashboard_name" { type = string }
variable "lambda_function_name" { type = string }
variable "sqs_queue_name" { type = string }
variable "sqs_dlq_name" { type = string }
variable "rds_instance_id" { type = string }
variable "redis_cluster_id" { type = string }
variable "alb_arn_suffix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
