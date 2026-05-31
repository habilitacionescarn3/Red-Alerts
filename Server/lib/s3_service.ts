// s3_service.ts - the S3 bucket that holds the React client build.
//
// The bucket is configured as an S3 STATIC WEBSITE (public-read) and CloudFront
// reaches it through the website endpoint as a plain HTTP origin (see
// cloudfront_service.ts). This is the same setup as the other apps on the
// account (e.g. Elytra) and it gives us SPA deep-link fallback for free: the
// website's error document is set to index.html, so any unknown key (a
// client-side route like /he/... refreshed directly) is served index.html and
// the React router resolves it - no CloudFront Function / error responses
// needed.

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface S3ServiceProps {
  /** App domain served by CloudFront - also the bucket's name (dots allowed). */
  readonly domain: string;
}

export class S3Service extends Construct {
  /** Public website bucket for the client build; served via CloudFront. */
  public readonly clientBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ServiceProps) {
    super(scope, id);

    this.clientBucket = new s3.Bucket(this, "clientBucket", {
      bucketName: props.domain,
      versioned: false,
      // Static website hosting. index.html is BOTH the index and the error
      // document, so unknown keys (SPA routes) fall back to the app shell.
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      // Website hosting requires public read. Block ACLs (we don't use them) but
      // allow the public-read bucket POLICY that publicReadAccess attaches.
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
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
