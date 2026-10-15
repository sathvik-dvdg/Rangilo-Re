output "parameter_prefix" {
  description = "e.g. /garbaconnect/prod"
  value       = local.prefix
}

output "env_path" {
  description = "Path whose parameters become the container's environment."
  value       = "${local.prefix}/env/"
}

output "image_tag_parameter_name" {
  value = aws_ssm_parameter.image_tag.name
}

output "image_tag_parameter_arn" {
  value = aws_ssm_parameter.image_tag.arn
}

output "public_build_parameter_arns" {
  description = "NEXT_PUBLIC_* parameters, which deploy.yml reads at build time."
  value       = [for name, p in aws_ssm_parameter.plain : p.arn if startswith(name, "NEXT_PUBLIC_")]
}

output "parameter_names" {
  description = "Every parameter to fill in with real values."
  value       = sort(concat([for p in aws_ssm_parameter.secret : p.name], [for p in aws_ssm_parameter.plain : p.name]))
}
