// iot_service.ts - the single broadcast topic and the subscriber permission model.
//
// Topics in AWS IoT Core are not CloudFormation resources (they exist implicitly).
// Browser subscribers authenticate with temporary AWS credentials from a Cognito
// (unauthenticated) identity pool and connect over MQTT-over-WSS using SigV4, so
// their authorization is expressed as IAM statements (built here) rather than an
// IoT policy. The worker's publish permission lives in iam_service.ts.

import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface IotServiceProps {
  /** The single broadcast topic name (e.g. "alerts"). */
  readonly topic: string;
}

export class IotService extends Construct {
  public readonly topic: string;
  public readonly topicArn: string;

  constructor(scope: Construct, id: string, props: IotServiceProps) {
    super(scope, id);

    const { account, region } = Stack.of(this);
    this.topic = props.topic;
    this.topicArn = `arn:aws:iot:${region}:${account}:topic/${props.topic}`;
  }

  /**
   * IAM statements granting anonymous browsers subscribe/receive on the broadcast
   * topic only, and explicitly denying publish. Consumed by the Cognito unauth role.
   */
  public subscriberPolicyStatements(): iam.PolicyStatement[] {
    const { account, region } = Stack.of(this);
    return [
      new iam.PolicyStatement({
        sid: "AllowConnect",
        actions: ["iot:Connect"],
        resources: [`arn:aws:iot:${region}:${account}:client/*`],
      }),
      new iam.PolicyStatement({
        sid: "AllowSubscribeBroadcast",
        actions: ["iot:Subscribe"],
        resources: [`arn:aws:iot:${region}:${account}:topicfilter/${this.topic}`],
      }),
      new iam.PolicyStatement({
        sid: "AllowReceiveBroadcast",
        actions: ["iot:Receive"],
        resources: [this.topicArn],
      }),
      new iam.PolicyStatement({
        sid: "DenyPublish",
        effect: iam.Effect.DENY,
        actions: ["iot:Publish"],
        resources: ["*"],
      }),
    ];
  }
}
