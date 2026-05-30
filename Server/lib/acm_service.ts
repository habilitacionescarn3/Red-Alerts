// acm_service.ts - imports the (manually created, us-east-1) ACM certificate by ARN.

import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

export interface AcmServiceProps {
  /** ARN of the ACM certificate created manually in us-east-1 (for CloudFront). */
  readonly certArn: string;
}

/**
 * CloudFront requires its certificate to live in us-east-1. Per the project
 * decision the certificate is created manually by the operator and only its ARN
 * is supplied here - this construct creates no certificate resource.
 */
export class AcmService extends Construct {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: AcmServiceProps) {
    super(scope, id);

    this.certificate = acm.Certificate.fromCertificateArn(
      this,
      "appCertificate",
      props.certArn
    );
  }
}
