variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "shopcloud"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "enable_networking" {
  type    = bool
  default = false
}

variable "enable_ecr" {
  type    = bool
  default = false
}

variable "enable_eks" {
  type    = bool
  default = false
}

variable "enable_rds" {
  type    = bool
  default = false
}

variable "enable_redis" {
  type    = bool
  default = false
}

variable "enable_s3" {
  type    = bool
  default = false
}

variable "enable_sqs" {
  type    = bool
  default = false
}

variable "enable_lambda" {
  type    = bool
  default = false
}

variable "enable_cognito" {
  type    = bool
  default = false
}

variable "enable_monitoring" {
  type    = bool
  default = false
}

variable "enable_edge" {
  type    = bool
  default = false
}

variable "enable_client_vpn" {
  type    = bool
  default = false
}