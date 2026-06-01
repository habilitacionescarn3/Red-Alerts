/**
 * AWS IoT realtime configuration - resolved at runtime from the domain the app
 * is served on, so ONE static build works for every environment.
 *
 * Browsers have no AWS credentials, so they obtain TEMPORARY ones from a Cognito
 * UNAUTHENTICATED identity pool and connect to AWS IoT Core over MQTT-over-WSS
 * signed with SigV4. The worker publishes every new alert ONCE to a single
 * broadcast topic; all subscribers receive it.
 *
 * None of these values are secrets - the IoT endpoint, Cognito (unauth) identity
 * pool id, region and topic are all public by design (any browser that connects
 * sees them). No env vars / secrets live in the frontend.
 *
 * Environment is detected from `window.location.hostname`:
 *   red-alerts.shalev396.com        -> prod   (apex; also the localhost fallback)
 *   dev.red-alerts.shalev396.com    -> dev
 *   qa.red-alerts.shalev396.com     -> qa
 * From the env we DERIVE the endpoint (`iot.<app-domain>`) and topic
 * (`red-alerts-<env>-alerts`). The only value we cannot derive is the identity
 * pool id (a generated, per-account AWS id) - it lives in IDENTITY_POOLS below,
 * filled once from each stack's "IdentityPoolId" output.
 */
import type { IotConfig } from '@/types/alerts';

type Env = 'prod' | 'dev' | 'qa';

/** AWS region of the deployed stacks (single region for every env). */
const REGION = 'il-central-1';

/** Apex app domain (prod). Used as the fallback when running on localhost. */
const PROD_APP_DOMAIN = 'red-alerts.shalev396.com';

/**
 * Cognito unauthenticated identity pool id per environment (stack output
 * "IdentityPoolId"). This is the ONE value that can't be derived from the domain
 * - it's a generated AWS id and each env is its own account/pool. NOT a secret.
 * Fill dev/qa once those stacks are deployed; a blank id leaves that env on the
 * polling fallback (see `isIotConfigured`).
 */
const IDENTITY_POOLS: Record<Env, string> = {
  prod: 'il-central-1:caab1a3f-8da5-43ca-92d6-f65ec2cf3820',
  dev: '',
  qa: '',
};

/** Map the served hostname to an environment (apex + localhost -> prod). */
function detectEnv(hostname: string): Env {
  const sub = hostname.split('.')[0];
  if (sub === 'dev') return 'dev';
  if (sub === 'qa') return 'qa';
  return 'prod';
}

/** Resolve the IoT config for the host the app is currently served from. */
function resolveConfig(): IotConfig {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const env = detectEnv(hostname);

  // On the deployed site the hostname IS the app domain; on localhost (or any
  // non-deployed host) fall back to prod's domain so local dev talks to the real
  // (prod) AWS IoT endpoint.
  const isDeployed = hostname.endsWith(PROD_APP_DOMAIN);
  const appDomain = isDeployed ? hostname : PROD_APP_DOMAIN;

  return {
    region: REGION,
    endpoint: `iot.${appDomain}`,
    identityPoolId: IDENTITY_POOLS[env],
    topic: `red-alerts-${env}-alerts`,
  };
}

export const iotConfig: IotConfig = resolveConfig();

/** True only when every value needed to open the IoT WSS connection is present. */
export function isIotConfigured(): boolean {
  return Boolean(
    iotConfig.region && iotConfig.endpoint && iotConfig.identityPoolId,
  );
}
