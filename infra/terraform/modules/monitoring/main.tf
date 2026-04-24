resource "aws_cloudwatch_log_group" "lambda" {
  count             = var.enabled ? 1 : 0
  name              = "/shopcloud/lambda/invoice-generator"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_cloudwatch_dashboard" "this" {
  count          = var.enabled ? 1 : 0
  dashboard_name = "${var.dashboard_name}-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text"
        x    = 0
        y    = 0
        width = 24
        height = 4
        properties = {
          markdown = "ShopCloud dashboard placeholder. Add ALB, RDS, Lambda, and SQS widgets after resources exist."
        }
      }
    ]
  })
}