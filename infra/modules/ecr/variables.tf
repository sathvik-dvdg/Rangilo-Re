variable "name" {
  description = "Repository name, e.g. garbaconnect-prod."
  type        = string
}

variable "keep_images" {
  description = "How many images to keep; older ones expire. Rollback can only go back this far."
  type        = number
  default     = 20
}
