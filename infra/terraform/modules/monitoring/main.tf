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
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 4
        properties = {
          title   = "Invoice Pipeline"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.sqs_queue_name],
            [".", "ApproximateNumberOfMessagesVisible", "QueueName", var.sqs_dlq_name],
            ["AWS/Lambda", "Errors", "FunctionName", var.lambda_function_name],
            [".", "Invocations", ".", "."]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 4
        properties = {
          title   = "Data Layer"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id],
            [".", "DatabaseConnections", ".", "."],
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", var.redis_cluster_id]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 4
        width  = 24
        height = 6
        properties = {
          title   = "Public ALB"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            [".", "HTTPCode_ELB_5XX_Count", ".", "."],
            [".", "TargetResponseTime", ".", "."]
          ]
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count               = var.enabled ? 1 : 0
  alarm_name          = "${var.dashboard_name}-lambda-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "Invoice lambda is failing."
  dimensions = {
    FunctionName = var.lambda_function_name
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "sqs_backlog" {
  count               = var.enabled ? 1 : 0
  alarm_name          = "${var.dashboard_name}-sqs-backlog"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "Invoice queue backlog is growing."
  dimensions = {
    QueueName = var.sqs_queue_name
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_backlog" {
  count               = var.enabled ? 1 : 0
  alarm_name          = "${var.dashboard_name}-dlq-messages"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "Invoice DLQ contains messages."
  dimensions = {
    QueueName = var.sqs_dlq_name
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count               = var.enabled ? 1 : 0
  alarm_name          = "${var.dashboard_name}-rds-cpu"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 75
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "RDS CPU is high."
  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count               = var.enabled ? 1 : 0
  alarm_name          = "${var.dashboard_name}-alb-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "Public ALB is returning 5xx responses."
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
  tags = var.tags
}
