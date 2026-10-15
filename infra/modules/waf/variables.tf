variable "enabled" {
  description = "Create and attach the web ACL."
  type        = bool
  default     = false
}

variable "name" {
  type = string
}

variable "alb_arn" {
  type = string
}

variable "rate_limit_per_5_minutes" {
  description = "Requests one IP may send in 5 minutes before being blocked."
  type        = number
  default     = 10000
}
