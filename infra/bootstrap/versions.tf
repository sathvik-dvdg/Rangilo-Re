terraform {
  # 1.10: S3 native state locking (use_lockfile). 1.11: write-only arguments (config module).
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Bootstrap creates the state bucket, so its own state is local. Keep
  # bootstrap/terraform.tfstate somewhere safe (it holds no secrets).
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "garbaconnect"
      Stack     = "bootstrap"
      ManagedBy = "terraform"
    }
  }
}
