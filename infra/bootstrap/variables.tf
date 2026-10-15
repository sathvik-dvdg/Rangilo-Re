variable "region" {
  description = "AWS region for every GarbaConnect resource."
  type        = string
  default     = "ap-south-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket for Terraform state. envs/*/versions.tf name the same bucket."
  type        = string
  default     = "garbaconnect-tfstate-aps1"
}

variable "domain_name" {
  description = "Apex domain. Its Route 53 zone is shared by staging and prod."
  type        = string
  default     = "garbaconnect.online"
}
