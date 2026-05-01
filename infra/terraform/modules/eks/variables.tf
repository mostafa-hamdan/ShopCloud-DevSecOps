variable "enabled" { type = bool }
variable "cluster_name" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "node_subnet_ids" { type = list(string) }
variable "node_instance_type" { type = string }
variable "cluster_version" { type = string }
variable "desired_size" { type = number }
variable "min_size" { type = number }
variable "max_size" { type = number }
variable "tags" {
  type    = map(string)
  default = {}
}
