# Two identities per environment:
#
#   instance role  what the app instances may do: pull this environment's image,
#                  read this environment's parameters, write their logs, and be
#                  reached through Session Manager (no SSH).
#   deploy user    what deploy.yml may do with the access key stored in GitHub: push
#                  images, read the build-time public parameters, set image_tag,
#                  refresh the Auto Scaling group, alert. Nothing else, and only in
#                  this environment. Terraform does not create the access key (it
#                  would land in state); create it with the AWS CLI (infra/README.md).

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

locals {
  account_id      = data.aws_caller_identity.current.account_id
  region          = data.aws_region.current.region
  partition       = data.aws_partition.current.partition
  parameter_arn   = "arn:${local.partition}:ssm:${local.region}:${local.account_id}:parameter${var.parameter_prefix}"
  asg_arn_pattern = "arn:${local.partition}:autoscaling:${local.region}:${local.account_id}:autoScalingGroup:*:autoScalingGroupName/${var.asg_name}"
}

# ---------------------------------------------------------------- instance role

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

# Session Manager instead of SSH.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid       = "EcrPullThisEnvironment"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid       = "ReadThisEnvironmentsParameters"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = [local.parameter_arn, "${local.parameter_arn}/*"]
  }

  # SecureString parameters use the AWS managed key; decrypting is allowed only through SSM.
  statement {
    sid       = "DecryptParametersViaSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${local.region}.amazonaws.com"]
    }
  }

  statement {
    sid       = "WriteContainerLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = [var.log_group_arn, "${var.log_group_arn}:*"]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "app"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.name}-instance"
  role = aws_iam_role.instance.name
}

# ---------------------------------------------------------------- deploy user

resource "aws_iam_user" "deploy" {
  name = "${var.name}-github-deploy"
  tags = { Purpose = "deploy.yml access key for ${var.name}" }
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPushThisEnvironment"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid       = "ReadImageTagAndPublicBuildConfig"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = concat([var.image_tag_parameter_arn], var.public_build_parameter_arns)
  }

  statement {
    sid       = "SetImageTag"
    actions   = ["ssm:PutParameter"]
    resources = [var.image_tag_parameter_arn]
  }

  statement {
    sid       = "RefreshThisAutoScalingGroup"
    actions   = ["autoscaling:StartInstanceRefresh", "autoscaling:CancelInstanceRefresh"]
    resources = [local.asg_arn_pattern]
  }

  # Describe calls cannot be limited to one resource.
  statement {
    sid       = "WatchRefresh"
    actions   = ["autoscaling:DescribeInstanceRefreshes", "autoscaling:DescribeAutoScalingGroups"]
    resources = ["*"]
  }

  statement {
    sid       = "AlertOnFailedDeploy"
    actions   = ["sns:Publish"]
    resources = [var.alert_topic_arn]
  }
}

resource "aws_iam_user_policy" "deploy" {
  name   = "deploy"
  user   = aws_iam_user.deploy.name
  policy = data.aws_iam_policy_document.deploy.json
}
