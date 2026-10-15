variable "name" {
  description = "Name prefix, e.g. garbaconnect-prod."
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group the containers write to."
  type        = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alert_email" {
  description = "Email subscribed to alerts. Empty: the topic exists with no subscriber."
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "asg_name" {
  type = string
}

variable "error_rate_percent" {
  type    = number
  default = 5
}

variable "p95_latency_seconds" {
  type    = number
  default = 2
}

variable "cpu_alarm_percent" {
  type    = number
  default = 80
}
