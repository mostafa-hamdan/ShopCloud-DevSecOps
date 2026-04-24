variable "enabled" { type = bool }
variable "name_prefix" { type = string }
variable "repositories" { type = list(string) }
variable "tags" { type = map(string) default = {} }