// iot_domain_service.ts - a custom domain for the AWS IoT *data* endpoint so
// browsers connect to `iot.<app-domain>` (MQTT-over-WSS) instead of the raw
// "<id>-ats.iot.<region>.amazonaws.com" host.
//
// The IoT data endpoint is shared per account+region (not per stack), so this
// construct does NOT create a new endpoint - it registers a branded, env-scoped
// hostname in front of the existing one:
//   - a REGIONAL ACM cert (IoT requires the cert in the SAME region as the
//     endpoint - il-central-1 - unlike CloudFront's us-east-1 cert),
//   - an IoT domain configuration that presents that cert for `iotDomain`,
//   - a Route53 CNAME from `iotDomain` to the account's iot:Data-ATS endpoint.
// Browsers then SigV4-sign with host=iotDomain and IoT accepts it because the
// host matches a registered domain configuration.

import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as iot from "aws-cdk-lib/aws-iot";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cr from "aws-cdk-lib/custom-resources";
import * as CONSTANTS from "../constants";
import { resourceName } from "./naming";

export interface IotDomainServiceProps {
  /** Hosted zone that owns the domain (e.g. shalev396.com). */
  readonly hostedZoneName: string;
  /** Custom IoT domain to register, e.g. "iot.red-alerts.shalev396.com". */
  readonly iotDomain: string;
}

export class IotDomainService extends Construct {
  /** The custom IoT data domain browsers connect to. */
  public readonly iotDomain: string;

  constructor(scope: Construct, id: string, props: IotDomainServiceProps) {
    super(scope, id);
    this.iotDomain = props.iotDomain;

    const zone = route53.HostedZone.fromLookup(this, "iotDomainZone", {
      domainName: props.hostedZoneName,
    });

    // Regional cert (same region as the IoT data endpoint). DNS-validated via the
    // hosted zone so it issues automatically during deploy.
    const certificate = new acm.Certificate(this, "iotCertificate", {
      domainName: props.iotDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // The account's data endpoint host (shared per account+region). Discovered at
    // deploy time so it is never hardcoded.
    const dataEndpoint = new cr.AwsCustomResource(this, "iotDataEndpoint", {
      onUpdate: {
        service: "Iot",
        action: "describeEndpoint",
        parameters: { endpointType: "iot:Data-ATS" },
        physicalResourceId: cr.PhysicalResourceId.of("iot-data-endpoint"),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    const endpointAddress = dataEndpoint.getResponseField("endpointAddress");

    const domainConfig = new iot.CfnDomainConfiguration(this, "iotDomainConfig", {
      domainConfigurationName: resourceName(this, CONSTANTS.IOT.DOMAIN_CONFIG_NAME),
      domainName: props.iotDomain,
      serverCertificateArns: [certificate.certificateArn],
      serviceType: "DATA",
    });
    // The cert must exist (and be issued) before the domain configuration can use it.
    domainConfig.node.addDependency(certificate);

    // iotDomain -> the IoT data endpoint. The client connects to iotDomain; SNI
    // carries it, IoT matches the domain configuration and serves our cert.
    new route53.CnameRecord(this, "iotCname", {
      zone,
      recordName: props.iotDomain,
      domainName: endpointAddress,
    });
  }
}
