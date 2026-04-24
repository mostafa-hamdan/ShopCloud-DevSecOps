variable "enabled" { type = bool }
variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "engine_version" { type = string }
variable "instance_class" { type = string }
variable "multi_az" { type = bool }
variable "allocated_storage" { type = number }
variable "tags" { type = map(string) default = {} }