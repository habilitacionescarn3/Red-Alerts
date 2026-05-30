// s3_service.ts - the PRIVATE S3 bucket that holds the React client build.
//
// The bucket stays fully private (BLOCK_ALL); CloudFront reaches it via Origin
// Access Control (OAC) - see cloudfront_service.ts, which auto-attaches a bucket
// policy that allows ONLY that distribution. SPA deep-link fallback is handled by
// a CloudFront Function (not the bucket / not distribution-wide error responses),
// so we don't need the S3 website endpoint and never expose the bucket publicly.

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface S3ServiceProps {
  /** App domain served by CloudFront - also the bucket's name (dots allowed). */
  readonly domain: string;
}

export class S3Service extends Construct {
  /** Private bucket for the client build; served via CloudFront with OAC. */
  public readonly clientBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ServiceProps) {
    super(scope, id);

    this.clientBucket = new s3.Bucket(this, "clientBucket", {
      bucketName: props.domain,
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });
  }
}
