# The app's runtime configuration as SSM parameters, under
#   /garbaconnect/<env>/env/<VARIABLE>   one per environment variable the container gets
#   /garbaconnect/<env>/image_tag        the image the instances run; written by deploy.yml
#
# Terraform creates every parameter with a placeholder and never sees a real value.
# Secrets use the write-only `value_wo` argument, which is never stored in plan or
# state, and Terraform does not write it again unless secret_placeholder_version
# changes. Set the real values afterwards with the AWS CLI (infra/README.md).
#
# BILLING_MODE and RAZORPAY_* are deliberately absent: production runs in Free Mode.

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

locals {
  prefix = "/garbaconnect/${var.environment}"

  # Server-only secrets.
  secret_names = toset([
    "CLERK_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VAPID_PRIVATE_KEY",
  ])

  # Public or non-secret values. NEXT_PUBLIC_* are also read by deploy.yml at build time,
  # because Next inlines them into the browser bundle and the CSP. lib/push.ts needs all
  # three VAPID values before it sends anything.
  plain_names = toset([
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_SUBJECT",
  ])
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secret_names

  name             = "${local.prefix}/env/${each.value}"
  description      = "Server secret; set the real value with the AWS CLI"
  type             = "SecureString"
  value_wo         = "CHANGE_ME"
  value_wo_version = var.secret_placeholder_version
}

resource "aws_ssm_parameter" "plain" {
  for_each = local.plain_names

  name        = "${local.prefix}/env/${each.value}"
  description = "Set the real value with the AWS CLI"
  type        = "String"
  value       = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

# deploy.yml owns this value after creation. "unset" makes new instances wait (see the app module).
resource "aws_ssm_parameter" "image_tag" {
  name        = "${local.prefix}/image_tag"
  description = "Image tag (git SHA) the instances run; written by deploy.yml"
  type        = "String"
  value       = "unset"

  lifecycle {
    ignore_changes = [value]
  }
}
