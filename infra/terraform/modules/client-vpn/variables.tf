variable "enabled" { type = bool }
variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "client_cidr_block" { type = string }
variable "target_network_cidr" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
