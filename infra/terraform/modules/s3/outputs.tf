output "bucket_name" {
  value = try(aws_s3_bucket.this[0].bucket, null)
}