// cognito_service.ts - an unauthenticated identity pool so anonymous browsers can
// get temporary AWS credentials to subscribe to the IoT broadcast topic.

import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as CONSTANTS from "../constants";

export interface CognitoServiceProps {
  /** IAM statements (from IotService) the unauth role is granted. */
  readonly iotSubscriberStatements: iam.PolicyStatement[];
}

export class CognitoService extends Construct {
  public readonly identityPoolId: string;

  constructor(scope: Construct, id: string, props: CognitoServiceProps) {
    super(scope, id);

    const identityPool = new cognito.CfnIdentityPool(this, "identityPool", {
      identityPoolName: CONSTANTS.COGNITO.IDENTITY_POOL_NAME,
      allowUnauthenticatedIdentities: true,
    });

    // Trust policy is scoped to THIS identity pool's unauthenticated identities.
    const unauthRole = new iam.Role(this, "unauthRole", {
      roleName: "red-alerts-cognito-unauth-role",
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    props.iotSubscriberStatements.forEach((statement) =>
      unauthRole.addToPolicy(statement)
    );

    new cognito.CfnIdentityPoolRoleAttachment(this, "identityPoolRoles", {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      },
    });

    this.identityPoolId = identityPool.ref;
  }
}
