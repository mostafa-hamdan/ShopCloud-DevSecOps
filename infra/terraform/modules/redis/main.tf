resource "aws_elasticache_subnet_group" "this" {
  count      = var.enabled ? 1 : 0
  name       = "${var.name}-subnets"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  count       = var.enabled ? 1 : 0
  name        = "${var.name}-sg"
  description = "Redis access for ShopCloud"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.20.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  count                      = var.enabled ? 1 : 0
  replication_group_id       = var.name
  description                = "ShopCloud Redis"
  node_type                  = var.node_type
  engine                     = "redis"
  engine_version             = "7.1"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.this[0].name
  security_group_ids         = [aws_security_group.this[0].id]
  automatic_failover_enabled = var.multi_az
  multi_az_enabled           = var.multi_az
  num_cache_clusters         = var.multi_az ? 2 : 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  tags                       = var.tags
}