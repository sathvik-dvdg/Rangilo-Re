output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "certificate_arn" {
  description = "ARN of the validated certificate (waits for validation)."
  value       = aws_acm_certificate_validation.this.certificate_arn
}
