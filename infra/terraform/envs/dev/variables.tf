variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "shopcloud-new"
}

variable "project_name" {
  type    = string
  default = "shopcloud"
}

variable "environment" {
  type    = string
  default = "dev"
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

variable "public_alb_dns_name" {
  type    = string
  default = "k8s-publicshopcloud-c9b58cfdd0-112985133.us-east-1.elb.amazonaws.com"
}

variable "public_alb_zone_id" {
  type    = string
  default = "Z35SXDOTRQ7X7K"
}

variable "public_alb_arn_suffix" {
  type    = string
  default = "app/k8s-publicshopcloud-c9b58cfdd0/c84ee2795dfa9384"
}

variable "redis_cache_cluster_id" {
  type    = string
  default = "shopcloud-dev-redis-001"
}

variable "node_instance_type" {
  type    = string
  default = "t3.small"
}

variable "cluster_version" {
  type    = string
  default = "1.33"
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 3
}
