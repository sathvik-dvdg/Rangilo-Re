variable "environment" {
  description = "staging or prod."
  type        = string
}

variable "secret_placeholder_version" {
  description = "Raising this makes Terraform write the CHANGE_ME placeholder over every secret again. Leave it alone."
  type        = number
  default     = 1
}
