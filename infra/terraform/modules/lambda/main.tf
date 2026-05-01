data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  count              = var.enabled ? 1 : 0
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "this" {
  count = var.enabled ? 1 : 0
  name  = "${var.function_name}-policy"
  role  = aws_iam_role.this[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = "arn:aws:s3:::${var.invoice_bucket_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = var.queue_arn
      }
    ]
  })
}

resource "aws_lambda_function" "this" {
  count         = var.enabled ? 1 : 0
  function_name = var.function_name
  role          = aws_iam_role.this[0].arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  filename      = var.package_file
  source_code_hash = filebase64sha256(var.package_file)
  timeout       = 30

  environment {
    variables = {
      INVOICE_BUCKET = var.invoice_bucket_name
      EMAIL_SENDER   = var.email_sender
      DLQ_ARN        = var.dlq_arn
    }
  }

  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "this" {
  count            = var.enabled ? 1 : 0
  event_source_arn = var.queue_arn
  function_name    = aws_lambda_function.this[0].arn
  batch_size       = 5
}
