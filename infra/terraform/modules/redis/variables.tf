variable "enabled" { type = bool }
variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_type" { type = string }
variable "multi_az" { type = bool }
variable "tags" { type = map(string) default = {} }