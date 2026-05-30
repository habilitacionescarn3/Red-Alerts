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
import * as CONSTANTS from "../constants";

export class S3Service extends Construct {
  /** Private bucket for the client build; served via CloudFront with OAC. */
  public readonly clientBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const account = cdk.Stack.of(this).account;

    this.clientBucket = new s3.Bucket(this, "clientBucket", {
      bucketName: `${CONSTANTS.S3.CLIENT_BUCKET}-${account}`,
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
