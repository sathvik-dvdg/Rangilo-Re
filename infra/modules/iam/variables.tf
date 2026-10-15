variable "name" {
  description = "Name prefix, e.g. garbaconnect-prod."
  type        = string
}

variable "parameter_prefix" {
  description = "SSM path the instances may read, e.g. /garbaconnect/prod."
  type        = string
}

variable "image_tag_parameter_arn" {
  type = string
}

variable "public_build_parameter_arns" {
  description = "NEXT_PUBLIC_* parameters deploy.yml reads at build time."
  type        = list(string)
}

variable "ecr_repository_arn" {
  type = string
}

variable "log_group_arn" {
  type = string
}

variable "asg_name" {
  description = "Auto Scaling group the deploy role may refresh."
  type        = string
}

variable "alert_topic_arn" {
  type = string
}

variable "github_repository" {
  description = "owner/name of the repository whose workflows may deploy."
  type        = string
}

variable "github_environment" {
  description = "GitHub Environment the deploy job must run in (staging or production)."
  type        = string
}
