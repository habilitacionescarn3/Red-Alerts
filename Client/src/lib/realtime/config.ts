/**
 * AWS IoT realtime configuration.
 *
 * Browsers have no AWS credentials, so they obtain TEMPORARY ones from a Cognito
 * UNAUTHENTICATED identity pool and connect to AWS IoT Core over MQTT-over-WSS
 * signed with SigV4. The worker publishes every new alert ONCE to a single
 * broadcast topic; all subscribers receive it.
 *
 * These values are NOT secrets - the IoT data endpoint, Cognito (unauth)
 * identity pool id, region and topic are all public by design (any browser that
 * connects sees them). They are kept here as plain constants (NO env vars /
 * secrets in the frontend); fill ENDPOINT + IDENTITY_POOL_ID from the deployed
 * stack outputs:
 *   - IDENTITY_POOL_ID  -> CDK output "IdentityPoolId"
 *   - TOPIC             -> CDK output "IotBroadcastTopic" (e.g. red-alerts-prod-alerts)
 *   - ENDPOINT          -> aws iot describe-endpoint --endpoint-type iot:Data-ATS
 *
 * While ENDPOINT / IDENTITY_POOL_ID are blank the realtime layer is considered
 * unconfigured and the app transparently falls back to API polling.
 */
export interface IotConfig {
  region: string;
  endpoint: string;
  identityPoolId: string;
  topic: string;
}

/** AWS region of the deployed stack. */
const REGION = 'il-central-1';

/**
 * IoT *data* (ATS) endpoint host, e.g.
 * "a1b2c3d4e5f6-ats.iot.il-central-1.amazonaws.com". Leave blank until known.
 */
const ENDPOINT = '';

/** Cognito unauthenticated identity pool id (stack output "IdentityPoolId"). */
const IDENTITY_POOL_ID = '';

/** Broadcast topic the worker publishes to (stack output "IotBroadcastTopic"). */
const TOPIC = 'alerts';

export const iotConfig: IotConfig = {
  region: REGION,
  endpoint: ENDPOINT,
  identityPoolId: IDENTITY_POOL_ID,
  topic: TOPIC,
};

/** True only when every value needed to open the IoT WSS connection is present. */
export function isIotConfigured(): boolean {
  return Boolean(iotConfig.region && iotConfig.endpoint && iotConfig.identityPoolId);
}
