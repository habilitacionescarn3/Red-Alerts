# API Gateway Outputs
output "api_gateway_url" {
  description = "The base URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_health_url" {
  description = "The health check URL"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/api/health"
}

output "api_gateway_id" {
  description = "The ID of the API Gateway"
  value       = aws_apigatewayv2_api.main.id
}

# ECR Repository Outputs
output "ecr_repository_url" {
  description = "The URL of the ECR repository"
  value       = aws_ecr_repository.app_repo.repository_url
}

output "ecr_repository_name" {
  description = "The name of the ECR repository"
  value       = aws_ecr_repository.app_repo.name
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "The name of the ECS service"
  value       = aws_ecs_service.api.name
}

# EC2 Instance Direct Access
output "ec2_public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = aws_eip.ecs_instance.public_ip
}

output "ec2_direct_url" {
  description = "Direct URL to access the EC2 instance"
  value       = "http://${aws_eip.ecs_instance.public_ip}:${var.container_port}"
}

# EC2 Instance Outputs
output "ec2_instance_type" {
  description = "The EC2 instance type used"
  value       = var.ec2_instance_type
}

output "ec2_instance_id" {
  description = "The ID of the EC2 instance"
  value       = aws_instance.ecs_instance.id
}

output "elastic_ip_allocation_id" {
  description = "The allocation ID of the Elastic IP"
  value       = aws_eip.ecs_instance.id
}

# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = data.aws_vpc.default.id
}

output "subnet_ids" {
  description = "The IDs of the subnets"
  value       = data.aws_subnets.default.ids
}

# CloudWatch Log Groups
output "ecs_log_group_name" {
  description = "The name of the ECS CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_logs.name
}

output "api_gateway_log_group_name" {
  description = "The name of the API Gateway CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway_logs.name
}

# Environment Information
output "aws_region" {
  description = "The AWS region"
  value       = data.aws_region.current.name
}

output "aws_account_id" {
  description = "The AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

# Docker Commands for Reference
output "docker_build_commands" {
  description = "Commands to build and push Docker image to ECR"
  value = {
    login = "aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin ${aws_ecr_repository.app_repo.repository_url}"
    build = "docker build -t ${aws_ecr_repository.app_repo.name} ./Server/app"
    tag   = "docker tag ${aws_ecr_repository.app_repo.name}:latest ${aws_ecr_repository.app_repo.repository_url}:latest"
    push  = "docker push ${aws_ecr_repository.app_repo.repository_url}:latest"
  }
}

## Frontend/CloudFront/Route53/ACM outputs removed as requested.

# DynamoDB State Lock Table
output "terraform_state_lock_table" {
  description = "DynamoDB table used for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "terraform_state_lock_table_arn" {
  description = "ARN of the DynamoDB table used for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.arn
}



# Deployment Status Commands
output "deployment_status_commands" {
  description = "Useful commands for checking deployment status and logs"
  value = {
    check_ecs_status = "aws ecs describe-services --cluster ${aws_ecs_cluster.main.name} --services ${aws_ecs_service.api.name} --region ${data.aws_region.current.name}"
    view_ecs_logs = "aws logs tail ${aws_cloudwatch_log_group.ecs_logs.name} --follow --region ${data.aws_region.current.name}"
    view_api_logs = "aws logs tail ${aws_cloudwatch_log_group.api_gateway_logs.name} --follow --region ${data.aws_region.current.name}"
  }
}
