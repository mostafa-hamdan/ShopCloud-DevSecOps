resource "aws_sqs_queue" "dlq" {
  count                     = var.enabled ? 1 : 0
  name                      = "${var.name}-dlq"
  message_retention_seconds = 1209600
  tags                      = var.tags
}

resource "aws_sqs_queue" "main" {
  count                      = var.enabled ? 1 : 0
  name                       = "${var.name}-queue"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = 5
  })
  tags = var.tags
}