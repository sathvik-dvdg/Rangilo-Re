output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "github_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Set these four as the custom nameservers for the domain in GoDaddy."
  value       = aws_route53_zone.main.name_servers
}

output "terraform_plan_role_arn" {
  description = "GitHub variable TF_PLAN_ROLE_ARN."
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "GitHub variable TF_APPLY_ROLE_ARN."
  value       = aws_iam_role.terraform_apply.arn
}
