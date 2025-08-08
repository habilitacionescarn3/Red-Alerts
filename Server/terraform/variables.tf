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

## Frontend/CloudFront/Certificate variables removed as requested.
