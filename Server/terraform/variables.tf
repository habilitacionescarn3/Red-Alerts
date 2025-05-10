# Core Project Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# ECS Configuration
variable "ecs_cpu" {
  description = "CPU units for ECS task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Memory in MB for ECS task"
  type        = number
  default     = 256
}

variable "ecs_desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

# Domain Configuration
variable "enable_custom_domain" {
  description = "Whether to enable custom domain for API Gateway"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Custom domain name for the API"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for the domain"
  type        = string
  default     = ""
}

# CloudWatch Configuration
variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 7
}

# Application Configuration
variable "external_api_url" {
  description = "External API URL for the worker to poll"
  type        = string
  default     = ""
}

variable "secret_value" {
  description = "Secret value for the application"
  type        = string
  sensitive   = true
  default     = ""
}

# Container Configuration
variable "container_port" {
  description = "Port that the container listens on"
  type        = number
  default     = 8000
}

# EC2 Configuration
variable "ec2_instance_type" {
  description = "EC2 instance type for ECS container instance"
  type        = string
  default     = "t4g.nano"
}

# Security Configuration
variable "ssh_allowed_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Change this in production!
}

# Certificate Configuration
variable "certificate_domain_name" {
  description = "Primary domain name for the SSL certificate"
  type        = string
  default     = ""
}

variable "certificate_subject_alternative_names" {
  description = "Additional domain names for the SSL certificate"
  type        = list(string)
  default     = []
}

# CloudFront Configuration
variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "client_bucket_name" {
  description = "S3 bucket name for client assets"
  type        = string
  default     = ""
}

variable "cloudfront_distribution_comment" {
  description = "Comment/description for the CloudFront distribution"
  type        = string
  default     = ""
}
