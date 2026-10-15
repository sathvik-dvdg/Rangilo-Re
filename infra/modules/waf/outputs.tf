output "web_acl_arn" {
  description = "Null while the module is disabled."
  value       = one(aws_wafv2_web_acl.this[*].arn)
}
