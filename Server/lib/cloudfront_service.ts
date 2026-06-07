// cloudfront_service.ts - the CDN: /* -> S3 (client build), /api/* -> API Gateway.

import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface CloudfrontServiceProps {
  /** Bucket holding the React client build. */
  readonly clientBucket: s3.IBucket;
  /** Domain name of the API Gateway origin (for /api/*). */
  readonly apiOriginDomain: string;
  /** Imported ACM certificate (us-east-1). */
  readonly certificate: acm.ICertificate;
  /** Custom domain served by this distribution. */
  readonly domain: string;
}

export class CloudfrontService extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudfrontServiceProps) {
    super(scope, id);

    const apiOrigin = new origins.HttpOrigin(props.apiOriginDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // Short-lived cache for the last-24h endpoint. All browsers that invalidate
    // simultaneously after a broadcast share a single origin request; only the
    // first one reaches Lambda within any 3-second window.
    const last24hCachePolicy = new cloudfront.CachePolicy(
      this,
      "Last24hCachePolicy",
      {
        cachePolicyName: `RedAlerts-last24h-3s`,
        minTtl: Duration.seconds(0),
        defaultTtl: Duration.seconds(5),
        maxTtl: Duration.seconds(5),
        // Include limit= in the cache key so different limit values don't collide.
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }
    );

    // Default origin = the client bucket's S3 STATIC WEBSITE endpoint, reached
    // as a plain HTTP origin (the website endpoint only speaks HTTP). The bucket
    // is public-read and its error document is index.html (see s3_service.ts),
    // so S3 itself serves index.html for any unknown key - i.e. SPA deep-link
    // refreshes (e.g. /he/...) just work, with NO CloudFront Function and NO
    // distribution-wide error responses (so /api/* status codes stay intact).
    const clientOrigin = new origins.S3StaticWebsiteOrigin(props.clientBucket);

    this.distribution = new cloudfront.Distribution(this, "distribution", {
      comment: `${props.domain} - Red Alerts client + API`,
      defaultRootObject: "index.html",
      certificate: props.certificate,
      domainNames: [props.domain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // Default behavior -> everything WITHOUT an /api prefix goes to the S3
      // client website (which handles SPA deep-link fallback itself).
      defaultBehavior: {
        origin: clientOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        // /api/alerts/last-24h -> cached at CloudFront for 3 s (see last24hCachePolicy).
        // This behavior is matched before the wildcard /api/* below because
        // CloudFront always picks the most specific path first.
        "/api/alerts/last-24h": {
          origin: apiOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: last24hCachePolicy,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // /api/* -> API Gateway, never cached, forward the viewer request. No
        // error-response rewriting here, so API status codes pass through intact.
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
  }
}
