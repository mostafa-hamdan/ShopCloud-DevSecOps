variable "enabled" { type = bool }
variable "name" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
