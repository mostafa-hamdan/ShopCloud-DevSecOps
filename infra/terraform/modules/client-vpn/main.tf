resource "aws_security_group" "this" {
  count       = var.enabled ? 1 : 0
  name        = "${var.name}-sg"
  description = "Client VPN security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_ec2_client_vpn_endpoint" "this" {
  count                  = var.enabled ? 1 : 0
  description            = "ShopCloud admin VPN"
  server_certificate_arn = var.server_certificate_arn
  client_cidr_block      = var.client_cidr_block
  split_tunnel           = true
  security_group_ids     = [aws_security_group.this[0].id]

  authentication_options {
    type                       = "certificate-authentication"
    root_certificate_chain_arn = var.server_certificate_arn
  }

  connection_log_options {
    enabled = false
  }

  tags = var.tags
}

resource "aws_ec2_client_vpn_network_association" "this" {
  for_each               = var.enabled ? toset(var.subnet_ids) : []
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.this[0].id
  subnet_id              = each.value
}