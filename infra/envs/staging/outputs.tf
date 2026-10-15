# The GitHub Environment variables deploy.yml needs come from here (infra/README.md).

output "app_url" {
  description = "GitHub Environment variable APP_URL."
  value       = "https://${var.domain_name}"
}

output "deploy_role_arn" {
  description = "GitHub Environment variable AWS_DEPLOY_ROLE_ARN."
  value       = module.iam.deploy_role_arn
}

output "alert_topic_arn" {
  description = "GitHub Environment variable ALERT_TOPIC_ARN."
  value       = module.observability.alert_topic_arn
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "asg_name" {
  value = module.app.asg_name
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "parameters_to_fill" {
  description = "Set each with `aws ssm put-parameter --overwrite` before the first deploy."
  value       = module.config.parameter_names
}
