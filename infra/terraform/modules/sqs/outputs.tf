output "queue_arn" {
  value = try(aws_sqs_queue.main[0].arn, null)
}

output "queue_url" {
  value = try(aws_sqs_queue.main[0].url, null)
}

output "dlq_arn" {
  value = try(aws_sqs_queue.dlq[0].arn, null)
}
