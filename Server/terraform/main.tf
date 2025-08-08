# Configure Terraform and AWS Provider
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend (S3). Key and optional DynamoDB lock table are
  # provided at init-time via -backend-config in scripts.
  backend "s3" {
    bucket = "red-alerts-terraform-state"
    region = "il-central-1"
    encrypt = true
    # key            = "red-alerts/dev/deployment/terraform.tfstate"   # provided by scripts
    # dynamodb_table = "terraform-state-locks"                          # enabled post-bootstrap
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

# DynamoDB table for Terraform state locking (bootstrapped first, then
# enabled in backend reconfiguration). Creating this table with Terraform
# is safe as long as the initial 'terraform init' does not specify
# dynamodb_table yet. After creation, re-init with the table configured.
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-locks"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Name = "terraform-state-locks"
  })
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

# Add ECR permissions to ECS instance role
resource "aws_iam_role_policy_attachment" "ecs_instance_ecr_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
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

  # Allow all outbound traffic (needed for ECR, ECS, CloudWatch)
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
              # Update system and install required packages
              yum update -y
              yum install -y awscli
              
              # Configure ECS agent
              echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
              echo "ECS_ENABLE_CONTAINER_METADATA=true" >> /etc/ecs/ecs.config
              echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config
              echo "ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true" >> /etc/ecs/ecs.config
              echo "ECS_AVAILABLE_LOGGING_DRIVERS=[\"json-file\",\"awslogs\"]" >> /etc/ecs/ecs.config
              
              # Login to ECR to ensure Docker can pull images
              aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com
              
              # Restart ECS agent to pick up new configuration
              systemctl stop ecs
              systemctl start ecs
              systemctl enable ecs
              
              # Wait for ECS agent to start and register
              sleep 60
              
              # Log everything for debugging
              systemctl status ecs > /tmp/ecs-status.log 2>&1
              cat /etc/ecs/ecs.config > /tmp/ecs-config.log
              docker ps > /tmp/docker-ps.log 2>&1
              curl -s http://localhost:51678/v1/metadata > /tmp/ecs-metadata.log 2>&1
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

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/api/health || exit 1"]
        interval = 30
        timeout = 5
        retries = 3
        startPeriod = 60
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

  # Let ECS auto-place tasks on available container instances

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy,
    aws_cloudwatch_log_group.ecs_logs,
    aws_instance.ecs_instance,
    aws_eip_association.ecs_instance
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
  depends_on = [aws_cloudwatch_log_group.api_gateway_logs]
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

## Frontend, CloudFront, ACM, and Route53 resources removed as requested.