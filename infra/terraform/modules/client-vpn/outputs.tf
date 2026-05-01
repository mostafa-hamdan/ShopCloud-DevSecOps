output "endpoint_id" {
  value = try(aws_ec2_client_vpn_endpoint.this[0].id, null)
}

output "endpoint_dns_name" {
  value = try(aws_ec2_client_vpn_endpoint.this[0].dns_name, null)
}

output "client_cert_path" {
  value = try(local_sensitive_file.client_cert[0].filename, null)
}

output "client_key_path" {
  value = try(local_sensitive_file.client_key[0].filename, null)
}

output "ca_cert_path" {
  value = try(local_file.ca_cert[0].filename, null)
}
