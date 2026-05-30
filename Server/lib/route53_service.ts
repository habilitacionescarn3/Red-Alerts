// route53_service.ts - alias record pointing the app domain at CloudFront.

import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export interface Route53ServiceProps {
  /** The hosted zone that owns the domain (e.g. example.com). */
  readonly hostedZoneName: string;
  /** Full app domain to create the alias for (e.g. red-alerts.example.com). */
  readonly domain: string;
  /** CloudFront distribution to alias to. */
  readonly distribution: cloudfront.IDistribution;
}

export class Route53Service extends Construct {
  constructor(scope: Construct, id: string, props: Route53ServiceProps) {
    super(scope, id);

    const zone = route53.HostedZone.fromLookup(this, "appDomainZone", {
      domainName: props.hostedZoneName,
    });

    new route53.ARecord(this, "appAliasRecord", {
      zone,
      recordName: props.domain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(props.distribution)
      ),
    });
  }
}
