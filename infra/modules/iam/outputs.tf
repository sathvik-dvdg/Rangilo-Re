output "instance_profile_name" {
  value = aws_iam_instance_profile.instance.name
}

output "instance_role_arn" {
  value = aws_iam_role.instance.arn
}

output "deploy_user_name" {
  description = "IAM user whose access key goes into the GitHub Environment secrets."
  value       = aws_iam_user.deploy.name
}
