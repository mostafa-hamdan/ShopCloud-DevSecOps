variable "enabled" { type = bool }
variable "project_name" { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "public_alb_dns_name" { type = string }
variable "public_alb_zone_id" { type = string }
variable "tags" { type = map(string) default = {} }