# Security Policy

## Supported Versions

Red Alerts is actively maintained on the `main` branch.

| Version / Branch      | Supported |
| --------------------- | --------- |
| `main`                | ✅        |
| Older commits / forks | ❌        |

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting for this repository.

Include:

- affected area (`Client`, API Lambda, worker, shared codebase, infrastructure, IoT/Cognito auth, etc.)
- reproduction steps
- impact assessment
- proof of concept if available
- suggested fix if you have one

## Response Expectations

I will try to:

- acknowledge reports within 7 days
- validate and triage as soon as possible
- coordinate disclosure after a fix is ready

## Scope

Examples of in-scope areas:

- IoT / Cognito authorization (the public unauthenticated broadcast path)
- IAM policy and least-privilege boundaries
- API Gateway / CloudFront / Lambda request handling
- insecure default cloud configuration
- secret exposure
- privilege escalation in the CDK stack defaults

Out of scope:

- issues only affecting modified downstream forks
- missing hardening in a user's custom deployment that is outside Red Alerts defaults
- denial-of-service against the public Oref upstream feed
