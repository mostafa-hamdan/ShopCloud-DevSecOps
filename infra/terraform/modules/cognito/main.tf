resource "aws_cognito_user_pool" "customer" {
  count = var.enabled ? 1 : 0
  name  = "${var.project_name}-${var.environment}-customers"

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"
  tags                     = var.tags
}

resource "aws_cognito_user_pool_client" "customer" {
  count         = var.enabled ? 1 : 0
  name          = "customer-client"
  user_pool_id  = aws_cognito_user_pool.customer[0].id
  generate_secret = false
}

resource "aws_cognito_user_pool" "admin" {
  count = var.enabled ? 1 : 0
  name  = "${var.project_name}-${var.environment}-admins"

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }
  tags = var.tags
}

resource "aws_cognito_user_pool_client" "admin" {
  count           = var.enabled ? 1 : 0
  name            = "admin-client"
  user_pool_id    = aws_cognito_user_pool.admin[0].id
  generate_secret = false
}