terraform {
  # 1.10: S3 native state locking (use_lockfile). 1.11: write-only arguments (config module).
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # The bucket comes from bootstrap/ (variable state_bucket_name).
  backend "s3" {
    bucket       = "garbaconnect-tfstate-aps1"
    key          = "prod/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
