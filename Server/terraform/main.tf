# Configure Terraform and AWS Provider
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # S3 Backend for Remote State Management  
  backend "s3" {
    bucket = "red-alerts-terraform-state"
    key    = "deployment/terraform.tfstate"
    region = "il-central-1"
    # Note: Backend config cannot use variables directly
    # We'll use different state keys per environment via CI/CD environment variables
    # No encryption or DynamoDB locking specified for minimal setup
  }
}

provider "aws" {
  region = var.aws_region
}

# Data Sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Use default VPC to keep it simple
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Locals for common tags and naming
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# ECR Repository
resource "aws_ecr_repository" "app_repo" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = local.common_tags
}

# ECR Lifecycle Policy to manage image retention
resource "aws_ecr_lifecycle_policy" "app_repo_policy" {
  repository = aws_ecr_repository.app_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Note: ECS Tasks security group removed - using ECS Instance security group instead

# Note: ALB removed to reduce costs - API Gateway connects directly to EC2

# Note: VPC Endpoints removed to reduce costs
# ECS will use public subnets and pull from ECR over internet

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach the AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for ECS Task (application permissions)
resource "aws_iam_role" "ecs_task_role" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Optional: Add CloudWatch permissions to task role if needed
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${local.name_prefix}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Note: ALB, Target Group, and Listener removed to reduce costs

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

# Note: Removed capacity providers - using simple EC2 instance

# Data source for ECS-optimized AMI (ARM64)
data "aws_ami" "ecs_optimized" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-arm64-ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "ecs_instance_role" {
  name = "${local.name_prefix}-ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach ECS instance policy
resource "aws_iam_role_policy_attachment" "ecs_instance_role_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

# Note: EIP association now handled by Terraform directly

# IAM Instance Profile for EC2
resource "aws_iam_instance_profile" "ecs_instance_profile" {
  name = "${local.name_prefix}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance_role.name
}

# Security Group for EC2 Instance
resource "aws_security_group" "ecs_instance" {
  name        = "${local.name_prefix}-ecs-instance"
  description = "Security group for ECS EC2 instance"
  vpc_id      = data.aws_vpc.default.id

  # Allow API Gateway and direct HTTP access
  ingress {
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow SSH access (optional, for debugging)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-instance"
  })
}

# Elastic IP for stable public IP
resource "aws_eip" "ecs_instance" {
  domain = "vpc"
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-eip"
  })
}

# Note: Launch template removed - using simple EC2 instance

# Simple EC2 Instance (no auto-scaling complexity)
resource "aws_instance" "ecs_instance" {
  ami                         = data.aws_ami.ecs_optimized.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.ecs_instance.id]
  iam_instance_profile        = aws_iam_instance_profile.ecs_instance_profile.name
  associate_public_ip_address = true

  user_data = base64encode(<<-EOF
              #!/bin/bash
              echo ECS_CLUSTER=${aws_ecs_cluster.main.name} >> /etc/ecs/ecs.config
              # Force restart ECS agent
              stop ecs
              start ecs
              EOF
  )

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-instance"
  })

  # Force recreation to pick up user_data changes
  lifecycle {
    create_before_destroy = true
  }
}

# Associate Elastic IP to EC2 Instance  
resource "aws_eip_association" "ecs_instance" {
  instance_id   = aws_instance.ecs_instance.id
  allocation_id = aws_eip.ecs_instance.id
}

# ECS Task Definition (simplified for EC2)
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name   = "api"
      image  = "${aws_ecr_repository.app_repo.repository_url}:latest"
      cpu    = var.ecs_cpu
      memory = var.ecs_memory
      
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "SECRET"
          value = var.secret_value
        },
        {
          name  = "EXTERNAL_API_URL"
          value = var.external_api_url
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_logs.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }



      essential = true
    }
  ])

  tags = local.common_tags
}

# ECS Service (simplified for bridge networking)
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "EC2"

  # Force new deployment when task definition changes
  force_new_deployment = true

  # Deployment configuration for memory-constrained t4g.nano
  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 0

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy,
    aws_cloudwatch_log_group.ecs_logs,
    aws_instance.ecs_instance
  ]

  tags = local.common_tags

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Note: VPC Link and ALB removed to reduce costs - using direct HTTP integration to EC2

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "API Gateway for ${var.project_name} ${var.environment}"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }

  tags = local.common_tags
}

# API Gateway Integration to EC2 Instance
resource "aws_apigatewayv2_integration" "main" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://${aws_eip.ecs_instance.public_ip}:${var.container_port}"
  connection_type        = "INTERNET"
  payload_format_version = "1.0"

  depends_on = [aws_eip_association.ecs_instance]
}

# API Gateway Routes (simple proxy - forwards everything)
resource "aws_apigatewayv2_route" "proxy_all" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.main.id}"
}

# API Gateway Stage (auto-deployed)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
      errorType      = "$context.error.messageString"
    })
  }

  tags = local.common_tags
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# ========================
# S3 + CloudFront + Route53
# ========================

# S3 Bucket for React Frontend
resource "aws_s3_bucket" "frontend" {
  count  = var.enable_custom_domain ? 1 : 0
  bucket = var.client_bucket_name
  tags   = local.common_tags
}

# S3 Bucket Public Access Block (keep bucket private)
resource "aws_s3_bucket_public_access_block" "frontend" {
  count  = var.enable_custom_domain ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  block_public_acls       = true
  block_public_policy     = false  # Allow CloudFront OAC policy
  ignore_public_acls      = true
  restrict_public_buckets = false  # Allow CloudFront OAC policy
}

# S3 Bucket Website Configuration
resource "aws_s3_bucket_website_configuration" "frontend" {
  count  = var.enable_custom_domain ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# S3 Bucket Policy for CloudFront OAC
resource "aws_s3_bucket_policy" "frontend" {
  count      = var.enable_custom_domain ? 1 : 0
  bucket     = aws_s3_bucket.frontend[0].id
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend[0].arn}/*"
      }
    ]
  })
}

# ACM Certificate (must be in us-east-1 for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "frontend" {
  count             = var.enable_custom_domain ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.certificate_domain_name
  validation_method = "DNS"

  subject_alternative_names = var.certificate_subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

# Route53 Record for Certificate Validation
resource "aws_route53_record" "frontend_validation" {
  for_each = var.enable_custom_domain ? {
    for dvo in aws_acm_certificate.frontend[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

# Certificate Validation
resource "aws_acm_certificate_validation" "frontend" {
  count                   = var.enable_custom_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.frontend[0].arn
  validation_record_fqdns = [for record in aws_route53_record.frontend_validation : record.fqdn]
}

# CloudFront Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "frontend" {
  count                             = var.enable_custom_domain ? 1 : 0
  name                              = "${local.name_prefix}-frontend-oac"
  description                       = "OAC for ${local.name_prefix} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}



# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  count = var.enable_custom_domain ? 1 : 0
  comment = var.cloudfront_distribution_comment

  # S3 Origin for Frontend
  origin {
    domain_name              = aws_s3_bucket.frontend[0].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend[0].id
    origin_id                = "client-bucket"
  }

  # API Gateway Origin (no origin_path needed for $default stage)
  origin {
    domain_name = replace(replace(aws_apigatewayv2_api.main.api_endpoint, "https://", ""), "http://", "")
    origin_id   = "backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # Aliases
  aliases = [var.domain_name]

  # Default Cache Behavior (Frontend - S3) - Using AWS Managed Policies
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "client-bucket"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Use AWS Managed CachingOptimized Policy for S3
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # AWS Managed CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"  # AWS Managed CORS-S3Origin
  }

  # API Cache Behavior (/api/*) - Using AWS Managed CachingDisabled Policy
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "backend"
    compress               = false
    viewer_protocol_policy = "redirect-to-https"
    
    # Use AWS Managed CachingDisabled Policy
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # AWS Managed CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # AWS Managed AllViewerExceptHostHeader
  }

  # Price Class
  price_class = var.cloudfront_price_class

  # Restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL Certificate
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.frontend[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }



  tags = local.common_tags
}

# Route53 Record for CloudFront
resource "aws_route53_record" "frontend" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend[0].domain_name
    zone_id                = aws_cloudfront_distribution.frontend[0].hosted_zone_id
    evaluate_target_health = false
  }
}
