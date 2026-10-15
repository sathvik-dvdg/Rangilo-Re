# The GitHub Environment variables deploy.yml needs come from here (infra/README.md).

output "app_url" {
  description = "GitHub Environment variable APP_URL."
  value       = "https://${var.domain_name}"
}

output "deploy_user_name" {
  description = "Create its access key with the AWS CLI and store it as this environment's GitHub secrets."
  value       = module.iam.deploy_user_name
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
