variable "name" {
  description = "Name prefix, e.g. garbaconnect-prod."
  type        = string
}

variable "cidr_block" {
  description = "VPC CIDR (a /16). Public subnets take .0 and .1, private .10 and .11."
  type        = string
}
