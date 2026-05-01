variable "enabled" { type = bool }
variable "function_name" { type = string }
variable "package_file" { type = string }
variable "invoice_bucket_name" { type = string }
variable "queue_arn" { type = string }
variable "dlq_arn" { type = string }
variable "email_sender" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
