resource "tls_private_key" "ca" {
  count     = var.enabled ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "ca" {
  count                 = var.enabled ? 1 : 0
  private_key_pem       = tls_private_key.ca[0].private_key_pem
  is_ca_certificate     = true
  validity_period_hours = 8760
  allowed_uses = [
    "cert_signing",
    "crl_signing",
    "digital_signature",
    "key_encipherment",
  ]

  subject {
    common_name  = "${var.name}-ca"
    organization = "ShopCloud"
  }
}

resource "tls_private_key" "server" {
  count     = var.enabled ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "server" {
  count           = var.enabled ? 1 : 0
  private_key_pem = tls_private_key.server[0].private_key_pem

  subject {
    common_name  = "${var.name}.vpn.shopcloud.internal"
    organization = "ShopCloud"
  }
}

resource "tls_locally_signed_cert" "server" {
  count                 = var.enabled ? 1 : 0
  cert_request_pem      = tls_cert_request.server[0].cert_request_pem
  ca_private_key_pem    = tls_private_key.ca[0].private_key_pem
  ca_cert_pem           = tls_self_signed_cert.ca[0].cert_pem
  validity_period_hours = 8760
  allowed_uses = [
    "server_auth",
    "digital_signature",
    "key_encipherment",
  ]
}

resource "tls_private_key" "client" {
  count     = var.enabled ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "client" {
  count           = var.enabled ? 1 : 0
  private_key_pem = tls_private_key.client[0].private_key_pem

  subject {
    common_name  = "${var.name}-client"
    organization = "ShopCloud"
  }
}

resource "tls_locally_signed_cert" "client" {
  count                 = var.enabled ? 1 : 0
  cert_request_pem      = tls_cert_request.client[0].cert_request_pem
  ca_private_key_pem    = tls_private_key.ca[0].private_key_pem
  ca_cert_pem           = tls_self_signed_cert.ca[0].cert_pem
  validity_period_hours = 8760
  allowed_uses = [
    "client_auth",
    "digital_signature",
    "key_encipherment",
  ]
}

resource "aws_acm_certificate" "server" {
  count             = var.enabled ? 1 : 0
  private_key       = tls_private_key.server[0].private_key_pem
  certificate_body  = tls_locally_signed_cert.server[0].cert_pem
  certificate_chain = tls_self_signed_cert.ca[0].cert_pem
  tags              = var.tags
}

resource "aws_acm_certificate" "client_root" {
  count            = var.enabled ? 1 : 0
  private_key      = tls_private_key.ca[0].private_key_pem
  certificate_body = tls_self_signed_cert.ca[0].cert_pem
  tags             = var.tags
}

resource "local_sensitive_file" "client_cert" {
  count    = var.enabled ? 1 : 0
  filename = "${path.root}/../../../../runtime/client-vpn/${var.name}-client.crt"
  content  = tls_locally_signed_cert.client[0].cert_pem
}

resource "local_sensitive_file" "client_key" {
  count    = var.enabled ? 1 : 0
  filename = "${path.root}/../../../../runtime/client-vpn/${var.name}-client.key"
  content  = tls_private_key.client[0].private_key_pem
}

resource "local_file" "ca_cert" {
  count    = var.enabled ? 1 : 0
  filename = "${path.root}/../../../../runtime/client-vpn/${var.name}-ca.crt"
  content  = tls_self_signed_cert.ca[0].cert_pem
}

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
  server_certificate_arn = aws_acm_certificate.server[0].arn
  client_cidr_block      = var.client_cidr_block
  split_tunnel           = true
  transport_protocol     = "udp"
  vpn_port               = 443
  dns_servers            = ["10.20.0.2"]

  authentication_options {
    type                       = "certificate-authentication"
    root_certificate_chain_arn = aws_acm_certificate.client_root[0].arn
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

resource "aws_ec2_client_vpn_authorization_rule" "vpc" {
  count                  = var.enabled ? 1 : 0
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.this[0].id
  target_network_cidr    = var.target_network_cidr
  authorize_all_groups   = true
  description            = "Allow ShopCloud VPC access"
}
