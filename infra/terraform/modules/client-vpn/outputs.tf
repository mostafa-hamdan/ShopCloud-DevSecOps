output "endpoint_id" {
  value = try(aws_ec2_client_vpn_endpoint.this[0].id, null)
}