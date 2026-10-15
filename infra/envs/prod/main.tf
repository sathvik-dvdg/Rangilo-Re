# One GarbaConnect environment. envs/staging and envs/prod share this file
# unchanged; their differences live in terraform.tfvars and the state key.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "garbaconnect"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name           = "garbaconnect-${var.environment}"
  log_group_name = "/garbaconnect/${var.environment}/app"
}

module "network" {
  source     = "../../modules/network"
  name       = local.name
  cidr_block = var.vpc_cidr
}

module "dns_cert" {
  source      = "../../modules/dns_cert"
  zone_name   = var.zone_name
  domain_name = var.domain_name
}

module "alb" {
  source              = "../../modules/alb"
  name                = local.name
  vpc_id              = module.network.vpc_id
  vpc_cidr_block      = module.network.vpc_cidr_block
  public_subnet_ids   = module.network.public_subnet_ids
  certificate_arn     = module.dns_cert.certificate_arn
  deletion_protection = var.deletion_protection
}

module "ecr" {
  source = "../../modules/ecr"
  name   = local.name
}

module "config" {
  source      = "../../modules/config"
  environment = var.environment
}

module "observability" {
  source                  = "../../modules/observability"
  name                    = local.name
  log_group_name          = local.log_group_name
  alert_email             = var.alert_email
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  asg_name                = local.name
}

module "iam" {
  source                      = "../../modules/iam"
  name                        = local.name
  parameter_prefix            = module.config.parameter_prefix
  image_tag_parameter_arn     = module.config.image_tag_parameter_arn
  public_build_parameter_arns = module.config.public_build_parameter_arns
  ecr_repository_arn          = module.ecr.repository_arn
  log_group_arn               = module.observability.log_group_arn
  asg_name                    = local.name
  alert_topic_arn             = module.observability.alert_topic_arn
  github_repository           = var.github_repository
  github_environment          = var.github_environment
}

module "app" {
  source                = "../../modules/app"
  name                  = local.name
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_arn
  instance_type         = var.instance_type
  min_size              = var.min_size
  max_size              = var.max_size
  instance_profile_name = module.iam.instance_profile_name
  ecr_repository_url    = module.ecr.repository_url
  parameter_prefix      = module.config.parameter_prefix
  log_group_name        = module.observability.log_group_name
}

module "waf" {
  source  = "../../modules/waf"
  enabled = var.enable_waf
  name    = local.name
  alb_arn = module.alb.alb_arn
}

resource "aws_route53_record" "app" {
  zone_id = module.dns_cert.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}
