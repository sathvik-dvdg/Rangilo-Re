variable "name" {
  description = "Name of the load balancer and target group (32 characters at most)."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr_block" {
  description = "The load balancer may only send traffic into this range."
  type        = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  description = "Validated ACM certificate for the HTTPS listener."
  type        = string
}

variable "app_port" {
  description = "Port the app container listens on."
  type        = number
  default     = 3000
}

variable "deletion_protection" {
  description = "Refuse to delete the load balancer (on in prod)."
  type        = bool
  default     = false
}
