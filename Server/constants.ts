/**
 * constants.ts - Central, NON-SECRET configuration for the Red Alerts CDK stack.
 *
 * IMPORTANT - secrets policy:
 *   This file must ONLY ever contain non-secret configuration (never secret
 *   values). Sensitive / account-specific values (AWS account id, ACM cert ARN,
 *   the MySQL connection URL, VPC/subnet ids, domain) are passed in at deploy
 *   time via CDK context (see bin/red-alerts.ts) and are NEVER committed to git.
 */

/** The single region this stack is deployed to. */
export const DEFAULT_REGION = "il-central-1";

/** CloudFront's ACM certificate must live in us-east-1 (created manually). */
export const CERT_REGION = "us-east-1";

/** Folder (relative to the CDK app root) holding Lambda handler source. */
export const RESOURCES_FOLDER_NAME = "resources";

export const APPLICATION = Object.freeze({
  /**
   * Logical application name. Also the BASE of the per-environment stack name
   * (see `stackName()`).
   */
  APP_NAME: "RedAlerts",
});

/**
 * Per-environment CloudFormation stack name: `<APP_NAME>-<env>`, e.g.
 * `stackName("prod")` -> "RedAlerts-prod". Each environment (dev/qa/prod) is its
 * OWN independent stack - never shared. Used by bin/red-alerts.ts (deploy) and
 * mirrored by the frontend pipeline when it reads the matching stack's outputs.
 */
export function stackName(env: string): string {
  return `${APPLICATION.APP_NAME}-${env}`;
}

// NOTE: physical resource names are no longer hardcoded here. The constants
// below hold only the bare <base> portion; the per-stack/per-env prefix
// (`red-alerts-<env>-`) is added at construction time by `resourceName()` in
// lib/naming.ts. The S3 client bucket is named after the app domain instead
// (see s3_service.ts), so it has no constant here.

export const ECR = Object.freeze({
  /**
   * Base name of the repository that holds the worker container image. The image
   * is built and pushed by `make push-docker` (NOT by CDK), then referenced here
   * by tag, so we control retention/rollback. The Makefile derives the same
   * per-env name (`red-alerts-$(ENV)-worker`) from this base - keep them in sync.
   */
  WORKER_REPO: "worker",
  /** Lifecycle keeps only the most recent N images (rollback headroom). */
  MAX_IMAGES: 5,
});

export const ECS = Object.freeze({
  /** ECS cluster (base name) that runs the always-on Oref poller. */
  CLUSTER_NAME: "worker-cluster",
  /** ECS service base name. */
  SERVICE_NAME: "worker-service",
  /** Task definition family base name. */
  TASK_FAMILY: "worker",
  /** Container base name inside the task definition. */
  CONTAINER_NAME: "worker",
  /** Cheapest ARM instance for the single-instance ECS capacity. */
  INSTANCE_TYPE: "t4g.nano",
});

export const LAMBDA_CONFIG = Object.freeze({
  /** Default memory for the API Lambda. */
  DEFAULT_MEMORY: 256,
  /** Default timeout (seconds) for the API Lambda. */
  DEFAULT_TIMEOUT: 30,
  /**
   * Base name of the deps layer that CDK builds from
   * resources/dependencies_layers/common-layer/requirements.txt.
   */
  COMMON_LAYER_NAME: "common-layer",
});

export const API_GATEWAY = Object.freeze({
  /** Base name of the HTTP API in front of the API Lambda. */
  API_NAME: "api",
});

export const IOT = Object.freeze({
  /**
   * Base name of the single broadcast topic. The worker publishes every new
   * alert here ONCE and all subscribed browsers receive it (not personalized).
   * The deployed topic is per-env (`red-alerts-<env>-alerts`).
   */
  BROADCAST_TOPIC: "alerts",
  /** IoT policy base name granted to anonymous (Cognito unauth) browser subscribers. */
  SUBSCRIBER_POLICY_NAME: "subscriber-policy",
});

export const COGNITO = Object.freeze({
  /** Identity pool (base name) that hands anonymous browsers temp creds for IoT. */
  IDENTITY_POOL_NAME: "identity-pool",
});

export const EXTERNAL = Object.freeze({
  /** Israel Home Front Command (Oref) live alerts endpoint polled by the worker. */
  OREF_ALERTS_URL: "https://www.oref.org.il/WarningMessages/alert/alerts.json",
});
