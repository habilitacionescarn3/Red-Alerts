# Red Alerts Backend

A serverless Python backend with ECS container service for continuous timestamp logging.

## Architecture

- **Lambda Functions**: Python-based API endpoints
  - `GET /api/health` - Health check (Hello World)
  - `POST /api/alerts` - Save alerts endpoint
- **ECS Service**: Continuous Python script logging timestamps every 5 seconds
- **Infrastructure**: Complete AWS setup with API Gateway, CloudFront, S3, Route 53

## Prerequisites

- Node.js and npm
- Docker
- AWS CLI configured
- Serverless Framework

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (create `.env` file or set in your shell):

```bash
# Domain configuration
DOMAIN_NAME_DEV=dev.redalerts.shalev396.com
DOMAIN_NAME_PROD=redalerts.shalev396.com
S3_BUCKET_NAME_DEV=red-alerts-client-dev
S3_BUCKET_NAME_PROD=red-alerts-client-prod
HOSTED_ZONE_ID=your-route53-hosted-zone-id

# SSL Certificates (create manually in ACM)
CERTIFICATE_ARN_DEV=arn:aws:acm:us-east-1:account:certificate/dev-cert-id
CERTIFICATE_ARN_PROD=arn:aws:acm:us-east-1:account:certificate/prod-cert-id
```

## Docker Build & Push (Native Commands)

```bash
# Get your AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=il-central-1

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Create ECR repository if it doesn't exist
aws ecr create-repository --repository-name red-alerts-service --region $REGION

# Build image
docker build -t red-alerts-service .

# Tag for ECR
docker tag red-alerts-service:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/red-alerts-service:latest

# Push to ECR
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/red-alerts-service:latest
```

## Deployment

```bash
# 1. Build and push Docker image (see above)

# 2. Deploy infrastructure
npm run deploy:dev   # or deploy:prod
```

## Development

```bash
# Run serverless offline (Lambda functions only)
npm run dev
```

## File Structure

```
Server/
├── src/
│   ├── handlers/
│   │   ├── health.py          # Hello World Lambda
│   │   └── saveAlerts.py      # Alert processing Lambda
│   └── ecs_timestamp_logger.py # ECS container script
├── Dockerfile                 # Simple Python container
├── requirements.txt           # Python dependencies
└── serverless.yml            # Infrastructure as code
```

## Infrastructure Components

✅ **Complete serverless infrastructure:**

- ECS Cluster with Fargate
- ECR Repository for Docker images
- Lambda Functions (Python 3.11)
- API Gateway (HTTP API with CORS)
- CloudFront Distribution
- S3 Bucket for client files
- Route 53 DNS configuration
- VPC, Subnets, Security Groups
- CloudWatch Logs

## Monitoring

- **ECS Service**: Logs to CloudWatch (`/ecs/red-alerts-service`)
- **Lambda Functions**: Automatic CloudWatch logging
- **API Gateway**: Request/response logging
- **CloudFront**: Access logs

## Notes

- SSL certificates must be created manually in ACM (us-east-1 region for CloudFront)
- ECS service runs continuously and logs timestamps every 5 seconds
- Docker image must be built and pushed before serverless deployment
- Each stage (dev/prod) gets completely separate infrastructure
- Serverless Framework automatically packages Python Lambda functions
