locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "networking" {
  source              = "../../modules/networking"
  enabled             = var.enable_networking
  name                = "${var.project_name}-${var.environment}"
  cidr                = "10.20.0.0/16"
  azs                 = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets      = ["10.20.0.0/24", "10.20.1.0/24"]
  private_subnets     = ["10.20.10.0/24", "10.20.11.0/24"]
  enable_nat_gateway  = false # NAT can cost money quickly.
  tags                = local.tags
}

module "ecr" {
  source       = "../../modules/ecr"
  enabled      = var.enable_ecr
  name_prefix  = "${var.project_name}/${var.environment}"
  repositories = ["frontend", "catalog", "cart", "checkout", "auth", "admin", "invoice-generator"]
  tags         = local.tags
}

module "eks" {
  source             = "../../modules/eks"
  enabled            = var.enable_eks
  cluster_name       = "${var.project_name}-${var.environment}"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  node_instance_type = "t3.small" # Keep cost-aware.
  desired_size       = 2
  min_size           = 2
  max_size           = 3
  tags               = local.tags
}

module "rds" {
  source              = "../../modules/rds"
  enabled             = var.enable_rds
  name                = "${var.project_name}-${var.environment}-postgres"
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  engine_version      = "16.4"
  instance_class      = "db.t3.micro" # Lowest practical starting point.
  multi_az            = false # Enable only after approval.
  allocated_storage   = 20
  tags                = local.tags
}

module "redis" {
  source         = "../../modules/redis"
  enabled        = var.enable_redis
  name           = "${var.project_name}-${var.environment}-redis"
  vpc_id         = module.networking.vpc_id
  subnet_ids     = module.networking.private_subnet_ids
  node_type      = "cache.t4g.micro"
  multi_az       = false # Enable only after approval.
  tags           = local.tags
}

module "s3" {
  source      = "../../modules/s3"
  enabled     = var.enable_s3
  bucket_name = "${var.project_name}-${var.environment}-invoices"
  tags        = local.tags
}

module "sqs" {
  source     = "../../modules/sqs"
  enabled    = var.enable_sqs
  name       = "${var.project_name}-${var.environment}-invoice"
  tags       = local.tags
}

module "lambda" {
  source               = "../../modules/lambda"
  enabled              = var.enable_lambda
  function_name        = "${var.project_name}-${var.environment}-invoice-generator"
  package_file         = "../../../lambda/invoice_generator/function.zip"
  invoice_bucket_name  = module.s3.bucket_name
  queue_arn            = module.sqs.queue_arn
  dlq_arn              = module.sqs.dlq_arn
  email_sender         = "replace-me@example.com"
  tags                 = local.tags
}

module "cognito" {
  source       = "../../modules/cognito"
  enabled      = var.enable_cognito
  project_name = var.project_name
  environment  = var.environment
  tags         = local.tags
}

module "monitoring" {
  source          = "../../modules/monitoring"
  enabled         = var.enable_monitoring
  dashboard_name  = "${var.project_name}-${var.environment}"
  tags            = local.tags
}

module "edge" {
  source              = "../../modules/edge"
  enabled             = var.enable_edge
  project_name        = var.project_name
  environment         = var.environment
  domain_name         = "example.com"
  public_alb_dns_name = "replace-me"
  public_alb_zone_id  = "replace-me"
  tags                = local.tags
}

module "client_vpn" {
  source              = "../../modules/client-vpn"
  enabled             = var.enable_client_vpn
  name                = "${var.project_name}-${var.environment}-admin"
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  server_certificate_arn = "replace-me"
  client_cidr_block   = "172.16.0.0/22"
  tags                = local.tags
}