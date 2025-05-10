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

# ========================
# CloudFront + S3 Outputs
# ========================

# S3 Bucket Outputs
output "s3_bucket_name" {
  description = "The name of the S3 bucket for frontend assets"
  value       = var.enable_custom_domain ? aws_s3_bucket.frontend[0].bucket : "N/A - Custom domain disabled"
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = var.enable_custom_domain ? aws_s3_bucket.frontend[0].arn : "N/A - Custom domain disabled"
}

output "s3_bucket_website_endpoint" {
  description = "The website endpoint of the S3 bucket"
  value       = var.enable_custom_domain ? aws_s3_bucket_website_configuration.frontend[0].website_endpoint : "N/A - Custom domain disabled"
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "The identifier for the CloudFront distribution"
  value       = var.enable_custom_domain ? aws_cloudfront_distribution.frontend[0].id : "N/A - Custom domain disabled"
}

output "cloudfront_distribution_domain_name" {
  description = "The domain name corresponding to the CloudFront distribution"
  value       = var.enable_custom_domain ? aws_cloudfront_distribution.frontend[0].domain_name : "N/A - Custom domain disabled"
}

output "cloudfront_distribution_hosted_zone_id" {
  description = "The CloudFront Route 53 zone ID"
  value       = var.enable_custom_domain ? aws_cloudfront_distribution.frontend[0].hosted_zone_id : "N/A - Custom domain disabled"
}

# ACM Certificate Outputs
output "acm_certificate_arn" {
  description = "The ARN of the ACM certificate"
  value       = var.enable_custom_domain ? aws_acm_certificate.frontend[0].arn : "N/A - Custom domain disabled"
}

output "acm_certificate_status" {
  description = "The status of the ACM certificate"
  value       = var.enable_custom_domain ? aws_acm_certificate.frontend[0].status : "N/A - Custom domain disabled"
}

# Route53 Outputs
output "route53_record_name" {
  description = "The name of the Route53 record"
  value       = var.enable_custom_domain ? aws_route53_record.frontend[0].name : "N/A - Custom domain disabled"
}

output "route53_record_fqdn" {
  description = "The FQDN built using the zone domain and name"
  value       = var.enable_custom_domain ? aws_route53_record.frontend[0].fqdn : "N/A - Custom domain disabled"
}

# Frontend URL
output "frontend_url" {
  description = "The frontend URL (CloudFront or S3 website endpoint)"
  value       = var.enable_custom_domain ? "https://${var.domain_name}" : "N/A - Custom domain disabled"
}

# S3 Sync Commands for Frontend Deployment
output "frontend_deployment_commands" {
  description = "Commands to deploy frontend to S3"
  value = var.enable_custom_domain ? {
    build_react = "cd Client && npm run build"
    sync_to_s3  = "aws s3 sync Client/dist/ s3://${aws_s3_bucket.frontend[0].bucket}/ --delete"
    invalidate_cloudfront = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.frontend[0].id} --paths '/*'"
  } : {
    build_react = "N/A - Custom domain disabled"
    sync_to_s3  = "N/A - Custom domain disabled"
    invalidate_cloudfront = "N/A - Custom domain disabled"
  }
}
