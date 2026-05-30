// cloudfront_service.ts - the CDN: /* -> S3 (client build), /api/* -> API Gateway.

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

    // Default origin = the PRIVATE client bucket, reached via Origin Access
    // Control. CDK auto-creates the OAC and attaches a bucket policy allowing
    // ONLY this distribution, so the bucket never needs public access.
    const clientOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      props.clientBucket as s3.Bucket
    );

    this.distribution = new cloudfront.Distribution(this, "distribution", {
      comment: `${props.domain} - Red Alerts client + API`,
      defaultRootObject: "index.html",
      certificate: props.certificate,
      domainNames: [props.domain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // Default behavior -> everything WITHOUT an /api prefix goes to the private
      // S3 client build (OAC).
      defaultBehavior: {
        origin: clientOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
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
