import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { iotConfig } from './config';

/**
 * Build a SigV4-presigned `wss://.../mqtt` URL for AWS IoT Core.
 *
 * Temporary Cognito credentials are signed for the `iotdevicegateway` service.
 * Per the AWS IoT WebSocket signing rules, the session (security) token is NOT
 * part of the signed canonical request - it is appended to the query string
 * AFTER signing.
 */
export async function buildPresignedIotUrl(): Promise<string> {
  const { region, endpoint, identityPoolId } = iotConfig;

  const credentials = await fromCognitoIdentityPool({
    identityPoolId,
    clientConfig: { region },
  })();

  const signer = new SignatureV4({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    region,
    service: 'iotdevicegateway',
    sha256: Sha256,
  });

  const request = new HttpRequest({
    method: 'GET',
    protocol: 'wss:',
    hostname: endpoint,
    path: '/mqtt',
    headers: { host: endpoint },
  });

  const presigned = await signer.presign(request, { expiresIn: 3600 });
  const query = presigned.query ?? {};

  const search = Object.keys(query)
    .sort()
    .map((key) => {
      const raw = query[key];
      const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  let url = `wss://${endpoint}/mqtt?${search}`;
  if (credentials.sessionToken) {
    url += `&X-Amz-Security-Token=${encodeURIComponent(credentials.sessionToken)}`;
  }
  return url;
}
