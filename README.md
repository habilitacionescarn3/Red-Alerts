# 🚨 Red Alerts - Israeli Alert System

A modern full-stack application that monitors Israeli alert systems with real-time updates. Built with FastAPI backend, React frontend, and deployed on AWS using Terraform.

## 🚀 **NEW: Local & CI/CD Deployment Synchronization**

**Quick Deploy**: Run `npm run deploy` locally for instant full-stack deployment!

### ✨ Key Features

- **🔒 State Locking**: DynamoDB prevents conflicts between local and CI/CD deployments
- **🔄 Perfect Sync**: Local deployments and CI/CD use identical npm scripts
- **⚡ One Command**: `npm run deploy` handles infrastructure + backend + frontend
- **🏗️ Zero Conflicts**: Multiple developers can work safely with automatic state locking

### 🎯 How It Works

1. **Local Development**: `npm run deploy` → Terraform checks state lock → Deploys everything
2. **Git Push**: CI/CD triggers → Uses same npm scripts → DynamoDB prevents conflicts
3. **Always Synchronized**: S3 bucket, infrastructure, and deployments stay perfectly in sync

### 🛡️ State Management

- **S3 Backend**: Terraform state in `red-alerts-terraform-state` bucket
- **DynamoDB Locking**: `red-alerts-terraform-locks` table prevents race conditions
- **Environment Isolation**: Separate state keys for dev/prod environments

---

## 🏗️ Architecture Overview

- **Frontend**: React + TypeScript + Tailwind CSS (deployed to S3 + CloudFront)
- **Backend**: FastAPI + Python (deployed to ECS on EC2)
- **Infrastructure**: AWS (S3, CloudFront, ECS, EC2, API Gateway, Route53)
- **Deployment**: Terraform + Docker + GitHub Actions CI/CD

## 📋 Deployment Scripts Overview

### 🚀 **Environment-Based Deployment**

All scripts now use environment variables from `.env` files for security and convenience. No PowerShell scripts needed!

#### **Environment Files**

```bash
# Create environment files from examples:
cp Server/env.dev.example Server/.env.dev
cp Server/env.prod.example Server/.env.prod

# Edit files with your AWS details:
# .env.dev   - Development environment variables
# .env.prod  - Production environment variables
```

**What the scripts do:**

1. Build Docker image for ARM64 architecture
2. Tag image with ECR repository URL from .env
3. Login to AWS ECR using region from .env
4. Push Docker image to ECR
5. Update ECS service to deploy new image

**Security Features:**

- Environment variables in .env files (gitignored)
- No hardcoded credentials in package.json
- Separate environment files for dev/prod
- Cross-platform compatible (no PowerShell required)

---

### 🔧 **npm Scripts (package.json)**

#### **Infrastructure Scripts**

```bash
npm run init              # Initialize Terraform
npm run workspace:create  # Create dev/prod workspaces
npm run workspace:list    # List available workspaces

# Development Environment
npm run plan:dev         # Plan infrastructure changes (dev)
npm run deploy:dev       # Deploy infrastructure (dev)
npm run destroy:dev      # Destroy infrastructure (dev)

# Production Environment
npm run plan:prod        # Plan infrastructure changes (prod)
npm run deploy:prod      # Deploy infrastructure (prod)
npm run destroy:prod     # Destroy infrastructure (prod)
```

#### **Docker & Application Scripts**

```bash
# Individual Docker Steps (require .env files)
npm run docker:build        # Build ARM64 Docker image
npm run docker:tag          # Tag with ECR URL from .env
npm run docker:login        # Login to ECR using .env
npm run docker:push         # Push to ECR using .env
npm run docker:deploy       # Complete Docker deployment (uses .env)
npm run update:ecs          # Update ECS service using .env

# Environment-Specific Docker Deployment
npm run docker:deploy:dev   # Docker deployment using .env.dev
npm run docker:deploy:prod  # Docker deployment using .env.prod
npm run update:ecs:dev      # Update ECS using .env.dev
npm run update:ecs:prod     # Update ECS using .env.prod

# Complete CI/CD Workflows
npm run cicd:dev            # Infrastructure + Docker + ECS (dev)
npm run cicd:prod           # Infrastructure + Docker + ECS (prod)

# Development Tools
npm run install             # Install Python dependencies
npm run update:pip          # Update pip to latest version
npm run dev                 # Run FastAPI locally
```

---

### 🤖 **GitHub Actions CI/CD**

#### **Workflow: `.github/workflows/deploy.yml`**

**Triggers:**

- Push to `dev` branch → Deploy to dev environment
- Push to `main` branch → Deploy to prod environment
- Manual workflow dispatch with environment selection

**What it does:**

1. **Setup**: Checkout code, configure AWS credentials, setup Terraform & Node.js
2. **Install**: Install npm dependencies
3. **Deploy**: Run `npm run cicd:dev` or `npm run cicd:prod`
4. **Environment Variables**: Uses GitHub Secrets for AWS credentials and resource names

---

## 🔐 Environment Variables

### **Local Development (.env files)**

Create environment files from the examples and fill in your values:

#### **`.env.dev` (Development Environment)**

```bash
# AWS Configuration
AWS_REGION=il-central-1

# ECR Repository
ECR_REPOSITORY=034362036555.dkr.ecr.il-central-1.amazonaws.com/red-alerts-dev-api

# ECS Configuration
ECS_CLUSTER=red-alerts-dev-cluster
ECS_SERVICE=red-alerts-dev-api
```

#### **`.env.prod` (Production Environment)**

```bash
# AWS Configuration
AWS_REGION=il-central-1

# ECR Repository
ECR_REPOSITORY=034362036555.dkr.ecr.il-central-1.amazonaws.com/red-alerts-prod-api

# ECS Configuration
ECS_CLUSTER=red-alerts-prod-cluster
ECS_SERVICE=red-alerts-prod-api
```

#### **Setup Instructions**

```bash
# 1. Copy example files
cp Server/env.dev.example Server/.env.dev
cp Server/env.prod.example Server/.env.prod

# 2. Install dotenv-cli
cd Server && npm install

# 3. Edit .env.dev and .env.prod with your AWS account details
# 4. Run deployment scripts with environment-specific configs
```

### **GitHub Secrets (CI/CD)**

```bash
# AWS Credentials (Repository Secrets)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=il-central-1

# Development Environment Secrets
DEV_ECR_REPOSITORY=034362036555.dkr.ecr.il-central-1.amazonaws.com/red-alerts-dev-api
DEV_ECS_CLUSTER=red-alerts-dev-cluster
DEV_ECS_SERVICE=red-alerts-dev-api

# Production Environment Secrets
PROD_ECR_REPOSITORY=034362036555.dkr.ecr.il-central-1.amazonaws.com/red-alerts-prod-api
PROD_ECS_CLUSTER=red-alerts-prod-cluster
PROD_ECS_SERVICE=red-alerts-prod-api
```

### **Terraform Variables (terraform-{env}.tfvars)**

```hcl
# Core Configuration
project_name = "red-alerts"
environment = "dev" | "prod"
aws_region = "il-central-1"

# Infrastructure
ec2_instance_type = "t4g.nano"
ecs_cpu = 256
ecs_memory = 512 | 256  # dev=512, prod=256
ecs_desired_count = 1

# Security
ssh_allowed_cidr_blocks = ["0.0.0.0/0"] | ["YOUR_IP/32"]  # dev=open, prod=restricted

# Domain & SSL
enable_custom_domain = true
domain_name = "dev.red-alerts.shalev396.com" | "red-alerts.shalev396.com"
hosted_zone_id = "Z0256679X8JG3LK6ATDW"
certificate_domain_name = "*.red-alerts.shalev396.com"
certificate_subject_alternative_names = ["dev.red-alerts.shalev396.com"] | ["red-alerts.shalev396.com"]

# Storage
client_bucket_name = "dev.red-alerts.shalev396.com" | "red-alerts.shalev396.com"
cloudfront_price_class = "PriceClass_All"

# Application
log_retention_days = 7
external_api_url = "https://www.oref.org.il/WarningMessages/alert/alerts.json"
secret_value = "dev-secret-54321" | "prod-secret-12345"
```

---

## 📊 AWS Resources by Environment

| Resource Type                          | Development                              | Production                                |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| **S3 Bucket**                          | `dev.red-alerts.shalev396.com`           | `red-alerts.shalev396.com`                |
| **CloudFront Distribution**            | Custom dev domain alias                  | Custom prod domain alias                  |
| **Route53 Record**                     | `dev.red-alerts.shalev396.com`           | `red-alerts.shalev396.com`                |
| **SSL Certificate**                    | `*.red-alerts.shalev396.com` (shared)    | `*.red-alerts.shalev396.com` (shared)     |
| **API Gateway**                        | `red-alerts-dev-api`                     | `red-alerts-prod-api`                     |
| **ECR Repository**                     | `red-alerts-dev-api`                     | `red-alerts-prod-api`                     |
| **ECS Cluster**                        | `red-alerts-dev-cluster`                 | `red-alerts-prod-cluster`                 |
| **ECS Service**                        | `red-alerts-dev-api`                     | `red-alerts-prod-api`                     |
| **ECS Task Definition**                | `red-alerts-dev-api`                     | `red-alerts-prod-api`                     |
| **EC2 Instance**                       | `red-alerts-dev-ecs-instance`            | `red-alerts-prod-ecs-instance`            |
| **Elastic IP**                         | `red-alerts-dev-ecs-eip`                 | `red-alerts-prod-ecs-eip`                 |
| **Security Group**                     | `red-alerts-dev-ecs-instance`            | `red-alerts-prod-ecs-instance`            |
| **IAM Role (Task Execution)**          | `red-alerts-dev-ecs-task-execution-role` | `red-alerts-prod-ecs-task-execution-role` |
| **IAM Role (Task)**                    | `red-alerts-dev-ecs-task-role`           | `red-alerts-prod-ecs-task-role`           |
| **IAM Role (EC2 Instance)**            | `red-alerts-dev-ecs-instance-role`       | `red-alerts-prod-ecs-instance-role`       |
| **CloudWatch Log Group (ECS)**         | `/ecs/red-alerts-dev-api`                | `/ecs/red-alerts-prod-api`                |
| **CloudWatch Log Group (API Gateway)** | `/aws/apigateway/red-alerts-dev-api`     | `/aws/apigateway/red-alerts-prod-api`     |

### **URL Endpoints**

| Environment     | Frontend URL                           | API URL                                      |
| --------------- | -------------------------------------- | -------------------------------------------- |
| **Development** | `https://dev.red-alerts.shalev396.com` | `https://dev.red-alerts.shalev396.com/api/*` |
| **Production**  | `https://red-alerts.shalev396.com`     | `https://red-alerts.shalev396.com/api/*`     |

### **CloudFront Behaviors**

| Path Pattern   | Origin      | Description          |
| -------------- | ----------- | -------------------- |
| `/*` (default) | S3 Bucket   | React frontend files |
| `/api/*`       | API Gateway | FastAPI backend      |

---

## 🚀 Quick Start

### **Setup Environment Files**

```bash
# 1. Create environment files from examples
cd Server
cp env.dev.example .env.dev
cp env.prod.example .env.prod

# 2. Edit .env.dev and .env.prod with your AWS account details
# 3. Install dependencies (includes dotenv-cli)
npm install
```

### **Local Development**

```bash
# 1. Deploy infrastructure
npm run deploy:dev

# 2. Deploy application with environment variables
npm run docker:deploy:dev && npm run update:ecs:dev

# 3. Run backend locally for development
npm run dev
```

### **Production Deployment**

```bash
# 1. Deploy infrastructure
npm run deploy:prod

# 2. Deploy application with environment variables
npm run docker:deploy:prod && npm run update:ecs:prod
```

### **Complete CI/CD (Infrastructure + Application)**

```bash
# Development
npm run cicd:dev

# Production
npm run cicd:prod
```

### **Git-Based CI/CD Deployment**

```bash
# Development: Push to dev branch
git push origin dev

# Production: Push to main branch
git push origin main

# Manual: Use GitHub Actions workflow dispatch
```

---

## 🔧 Development Tools

```bash
# FastAPI local development
npm run dev                 # Run FastAPI dev server on :8000

# Infrastructure management
npm run plan:dev           # Preview infrastructure changes
npm run destroy:dev        # Clean up dev resources

# Python environment
npm run install            # Install Python dependencies
npm run update:pip         # Update pip to latest version
```

---

## 🛡️ Security Features

- **Private S3 buckets** with Origin Access Control (OAC)
- **HTTPS-only** access via CloudFront
- **Environment-separated** AWS resources
- **SSH access restrictions** (configurable per environment)
- **Environment variables** in gitignored .env files
- **IAM roles** with least privilege principle

---

## 📁 Project Structure

```
red-Alerts/
├── Client/                    # React frontend
├── Server/                    # FastAPI backend
│   ├── app/                  # FastAPI application code
│   ├── terraform/            # Infrastructure as Code
│   ├── env.*.example         # Environment variable examples
│   ├── .env.dev              # Dev environment variables (gitignored)
│   ├── .env.prod             # Prod environment variables (gitignored)
│   └── package.json          # npm scripts for deployment
├── .github/workflows/        # CI/CD automation
└── README.md                # This file
```

---

## 🆘 Troubleshooting

### **Common Issues**

1. **Terraform errors**: Check AWS credentials and region settings
2. **Docker build fails**: Ensure Docker Desktop is running and buildx is available
3. **ECR login fails**: Verify AWS credentials and ECR repository exists
4. **ECS deployment stuck**: Check ECS service logs in AWS Console
5. **Domain not working**: Verify Route53 DNS propagation (can take 10+ minutes)
6. **dotenv errors**: Ensure .env files exist and npm install was run

### **Useful Commands**

```bash
# Check AWS credentials
aws sts get-caller-identity

# Check Terraform state
cd Server/terraform && terraform show

# Check Docker images
docker images | grep red-alerts

# Check ECS service status
aws ecs describe-services --cluster red-alerts-prod-cluster --services red-alerts-prod-api --region il-central-1

# Verify environment variables are loaded
cd Server && dotenv -e .env.dev -- env | grep ECR
```
