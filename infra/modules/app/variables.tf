variable "name" {
  description = "Name of the Auto Scaling group and prefix for the rest, e.g. garbaconnect-prod."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "min_size" {
  type    = number
  default = 2
}

variable "max_size" {
  type    = number
  default = 4
}

variable "cpu_target_percent" {
  description = "Average CPU the group scales to hold."
  type        = number
  default     = 60
}

variable "root_volume_gb" {
  type    = number
  default = 20
}

variable "instance_profile_name" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "parameter_prefix" {
  description = "SSM path holding image_tag and env/, e.g. /garbaconnect/prod."
  type        = string
}

variable "log_group_name" {
  type = string
}

variable "app_port" {
  type    = number
  default = 3000
}
