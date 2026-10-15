output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Set these four as the custom nameservers for the domain in GoDaddy."
  value       = aws_route53_zone.main.name_servers
}
