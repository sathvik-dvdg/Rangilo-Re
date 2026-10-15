variable "environment" {
  description = "staging or prod. Names resources (garbaconnect-<environment>) and the SSM path."
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment must be staging or prod."
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "zone_name" {
  description = "Route 53 zone created by bootstrap/."
  type        = string
  default     = "garbaconnect.online"
}

variable "domain_name" {
  description = "Hostname this environment serves."
  type        = string
}

variable "vpc_cidr" {
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

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "enable_waf" {
  type    = bool
  default = false
}

variable "alert_email" {
  description = "Receives alarm emails. Set TF_VAR_alert_email rather than committing it."
  type        = string
  default     = ""
}

variable "github_repository" {
  type    = string
  default = "sathvik-dvdg/Rangilo-Re"
}

variable "github_environment" {
  description = "GitHub Environment deploy.yml runs in for this environment."
  type        = string
}
