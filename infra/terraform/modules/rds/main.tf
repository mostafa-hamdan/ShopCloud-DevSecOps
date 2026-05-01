resource "aws_db_subnet_group" "this" {
  count      = var.enabled ? 1 : 0
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "this" {
  count       = var.enabled ? 1 : 0
  name        = "${var.name}-sg"
  description = "RDS access for ShopCloud"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
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

resource "aws_db_instance" "this" {
  count                       = var.enabled ? 1 : 0
  identifier                  = var.name
  engine                      = "postgres"
  engine_version              = var.engine_version
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  username                    = "shopcloud"
  manage_master_user_password = true
  db_name                     = "shopcloud"
  skip_final_snapshot         = true
  multi_az                    = var.multi_az
  publicly_accessible         = false
  storage_encrypted           = true
  db_subnet_group_name        = aws_db_subnet_group.this[0].name
  vpc_security_group_ids      = [aws_security_group.this[0].id]
  deletion_protection         = false
  backup_retention_period     = 1
  tags                        = var.tags
}