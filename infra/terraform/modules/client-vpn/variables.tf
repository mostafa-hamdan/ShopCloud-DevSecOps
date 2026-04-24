variable "enabled" { type = bool }
variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "server_certificate_arn" { type = string }
variable "client_cidr_block" { type = string }
variable "tags" { type = map(string) default = {} }