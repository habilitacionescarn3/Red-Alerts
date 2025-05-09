# 🚨 Red Alerts - Serverless Full-Stack Application

A complete serverless application with **Go backend** and **React frontend** deployed on AWS.

## 🏗️ Architecture

- **🐳 ECS Service**: Continuous monitoring (getAlerts) - prints timestamps every 5 seconds
- **⚡ Lambda Functions**: API endpoints (saveAlerts, health)
- **🌐 CloudFront + S3**: React frontend with global CDN
- **🔗 Route 53**: Custom domain DNS
- **🛡️ API Gateway**: HTTP API with CORS

## 🚀 Quick Commands

```bash
# Move to server directory
cd Server

# 1. Build everything (Go binaries + Docker)
npm run build

# 2. Deploy to production
npm run deploy:prod

# 3. Deploy to development
npm run deploy:dev

# 4. Test locally (runs Docker indefinitely)
npm run test
```

## 🌍 Live URLs

- **Production**: `https://red-alerts.shalev396.com`
- **Development**: `https://dev.red-alerts.shalev396.com`
- **API Health**: `/api/health`
- **Save Alerts**: `/api/alerts` (POST)

## 📁 Project Structure

```
red-Alerts/
├── Client/                 # React frontend
│   ├── src/
│   └── public/
└── Server/                 # Go backend
    ├── src/                # Go source code
    │   ├── getAlerts/      # ECS service (Docker)
    │   ├── saveAlerts/     # Lambda function
    │   └── health/         # Lambda function
    ├── scripts/            # Node.js build/test scripts
    ├── bin/                # Compiled Go binaries
    ├── serverless.yml      # AWS infrastructure
    └── package.json        # NPM commands
```

## 🔧 Go Modules Explained

### `go.mod`

Defines the Go module for the Red Alerts backend. This file:

- Sets the module name (`red-alerts-backend`)
- Specifies Go version (1.21)
- Lists direct dependencies (AWS Lambda Go SDK)
- Manages dependencies for all Lambda functions and ECS service

### `go.sum`

Contains cryptographic checksums for all dependencies. This file:

- Ensures dependency integrity and security
- Enables reproducible builds across environments
- Automatically maintained by Go module system
- Verifies downloaded modules haven't been tampered with

## 🎯 What Each Deploy Creates

### `npm run deploy:prod` creates:

- ✅ **S3 Bucket**: `red-alerts.shalev396.com`
- ✅ **CloudFront**: Global CDN with custom domain
- ✅ **Route 53**: DNS A record
- ✅ **ECS Service**: Smallest Fargate container (0.25 vCPU, 0.5GB)
- ✅ **Lambda Functions**: saveAlerts + health
- ✅ **API Gateway**: HTTP API with CORS
- ✅ **SSL/TLS**: End-to-end encryption

### `npm run deploy:dev` creates:

- Same infrastructure with `dev.` prefix for development

## 🧪 Testing

The `npm run test` command:

1. ✅ Validates all Go binaries exist
2. ✅ Runs Go tests
3. ✅ Starts Docker container locally
4. ✅ Shows live timestamps (runs until Ctrl+C)

Example output:

```
[2025-08-02 20:07:10 UTC] Red Alerts Service - Health Check
[2025-08-02 20:07:15 UTC] Red Alerts Service - Health Check
```

## 🎨 Frontend Integration

When your React app is ready:

1. Build React: `cd Client && npm run build`
2. Deploy to S3: The infrastructure is already configured
3. CloudFront will serve your React app with `/api/*` routing to Lambda

## 💰 Cost Optimized

- **Fargate Spot**: Up to 70% savings
- **Smallest containers**: 0.25 vCPU, 0.5GB RAM
- **Lambda**: Pay per request
- **CloudFront**: Global caching
- **S3**: Static hosting

## 🔐 Security

- **SSL/TLS**: Custom ACM certificates
- **IAM**: Minimal required permissions
- **VPC**: Isolated networking for ECS
- **CORS**: Configured for web access

## 📊 Monitoring

- **CloudWatch Logs**: ECS timestamps every 5 seconds
- **API Gateway**: Request/response logging
- **Lambda**: Error tracking and metrics

**Ready for production deployment!** 🚀
