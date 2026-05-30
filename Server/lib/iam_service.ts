// iam_service.ts - centralizes the IAM roles for the API Lambda and the ECS worker.
//
// NOTE: the Cognito *unauthenticated* role is created in cognito_service.ts instead,
// because its trust policy must reference the identity pool id (created there),
// which would otherwise create a circular dependency.

import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface IamServiceProps {
  /** Broadcast topic name the worker is allowed to publish to. */
  readonly iotTopic: string;
}

export class IamService extends Construct {
  /** Execution role for the API Lambda (logs + VPC ENIs). */
  public readonly lambdaApiRole: iam.Role;
  /** Task role assumed by the worker container (IoT publish + logs). */
  public readonly workerTaskRole: iam.Role;
  /** Execution role used by ECS to pull the image and write logs. */
  public readonly workerTaskExecutionRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamServiceProps) {
    super(scope, id);

    const { account, region } = Stack.of(this);

    // [API LAMBDA ROLE]
    // The DB connection is provided directly via the DATABASE_URL env var, so
    // the API needs no data-plane permissions - just logs + VPC ENIs.
    this.lambdaApiRole = new iam.Role(this, "lambdaApiRole", {
      roleName: "red-alerts-lambda-api-role",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        // VPC access policy is a superset of the basic execution role (logs)
        // and adds the ENI permissions a VPC-attached Lambda needs.
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
      ],
    });

    // [WORKER TASK ROLE] - runtime permissions for the poller container
    this.workerTaskRole = new iam.Role(this, "workerTaskRole", {
      roleName: "red-alerts-worker-task-role",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    // Resolving the IoT data endpoint does not support resource-level scoping.
    this.workerTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["iot:DescribeEndpoint"],
        resources: ["*"],
      })
    );
    // Publish ONLY to the single broadcast topic.
    this.workerTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["iot:Publish"],
        resources: [`arn:aws:iot:${region}:${account}:topic/${props.iotTopic}`],
      })
    );
    this.workerTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [`arn:aws:logs:${region}:${account}:*`],
      })
    );

    // [WORKER TASK EXECUTION ROLE] - image pull + log delivery
    this.workerTaskExecutionRole = new iam.Role(
      this,
      "workerTaskExecutionRole",
      {
        roleName: "red-alerts-worker-execution-role",
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonECSTaskExecutionRolePolicy"
          ),
        ],
      }
    );
  }
}
