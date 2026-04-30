module "vpc" {
  count   = var.enabled ? 1 : 0
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.18"

  name = var.name
  cidr = var.cidr
  azs  = var.azs

  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets

  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.enable_nat_gateway

  map_public_ip_on_launch = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = merge(var.tags, {
    "kubernetes.io/role/elb" = "1"
  })

  private_subnet_tags = merge(var.tags, {
    "kubernetes.io/role/internal-elb" = "1"
  })

  tags = var.tags
}
