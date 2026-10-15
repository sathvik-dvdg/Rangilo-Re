variable "zone_name" {
  description = "Route 53 public zone created by bootstrap/, e.g. garbaconnect.online."
  type        = string
}

variable "domain_name" {
  description = "Hostname the certificate is for, e.g. staging.garbaconnect.online."
  type        = string
}

variable "subject_alternative_names" {
  description = "Extra hostnames on the same certificate."
  type        = list(string)
  default     = []
}
