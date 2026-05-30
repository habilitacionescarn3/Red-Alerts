// naming.ts - derives per-stack/per-env physical resource names.
//
// Every named resource is prefixed with the kebab-lowercased CloudFormation
// stack name (e.g. "RedAlerts-prod" -> "red-alerts-prod") so independent
// environments (dev/qa/prod) can coexist in the same AWS account without name
// collisions. Constructs pass only the bare <base> portion (e.g. "worker-cluster").

import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * Kebab-cases and lowercases a stack name: "RedAlerts-prod" -> "red-alerts-prod".
 * Inserts a dash at lower/digit -> upper boundaries, then lowercases everything.
 */
export function slug(stackName: string): string {
  return stackName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Full physical name for a resource in `scope`'s stack: `<slug(stackName)>-<base>`,
 * e.g. resourceName(this, "api") -> "red-alerts-prod-api".
 */
export function resourceName(scope: Construct, base: string): string {
  return `${slug(Stack.of(scope).stackName)}-${base}`;
}
