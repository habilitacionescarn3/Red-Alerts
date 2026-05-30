// ecs_service.ts - the always-on Oref poller: ECS service on a single cheap EC2 (ARM).

import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as CONSTANTS from "../constants";
import { resourceName } from "./naming";

export interface EcsServiceProps {
  /** The existing VPC that hosts the (private) MySQL database. */
  readonly vpc: ec2.IVpc;
  /** Subnets to place the worker EC2 instances in. */
  readonly vpcSubnets: ec2.SubnetSelection;
  /** Shared security group applied to the worker EC2 instances (DB reachability). */
  readonly securityGroup: ec2.ISecurityGroup;
  /** Task role for the worker (read SSM parameter + IoT publish). */
  readonly taskRole: iam.IRole;
  /** Execution role (image pull + logs). */
  readonly executionRole: iam.IRole;
  /** Full MySQL connection URL (secret) passed to the worker container. */
  readonly databaseUrl: string;
  /** Broadcast topic the worker publishes to. */
  readonly iotTopic: string;
  /**
   * ECR repository (name) holding the worker image, plus the tag to run. The
   * image is built/pushed out-of-band by `make push-docker` (a git-sha tag), so
   * a new tag here forces ECS to roll out the new build.
   */
  readonly imageRepositoryName: string;
  readonly imageTag: string;
}

export class EcsService extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.Ec2Service;

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    const { region } = Stack.of(this);

    // Run inside the database's VPC so the worker can reach the private MySQL
    // instance. Compute lives in the private-with-egress (NAT) subnets so it
    // still has outbound internet access (Oref, IoT, ECR, SSM).
    this.cluster = new ecs.Cluster(this, "cluster", {
      clusterName: resourceName(this, CONSTANTS.ECS.CLUSTER_NAME),
      vpc: props.vpc,
    });

    // Single cheapest ARM instance. addCapacity wires up the instance role,
    // ECS agent and user data to join the cluster. With BRIDGE networking the
    // task uses the instance's network, so the shared SG is attached here.
    const capacity = this.cluster.addCapacity("workerCapacity", {
      instanceType: new ec2.InstanceType(CONSTANTS.ECS.INSTANCE_TYPE),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(
        ecs.AmiHardwareType.ARM
      ),
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      vpcSubnets: props.vpcSubnets,
    });
    capacity.addSecurityGroup(props.securityGroup);

    const taskDefinition = new ecs.Ec2TaskDefinition(this, "workerTask", {
      family: resourceName(this, CONSTANTS.ECS.TASK_FAMILY),
      networkMode: ecs.NetworkMode.BRIDGE,
      taskRole: props.taskRole,
      executionRole: props.executionRole,
    });

    // Pull the worker image from our own ECR repo (pushed by `make push-docker`).
    const workerRepository = ecr.Repository.fromRepositoryName(
      this,
      "workerRepo",
      props.imageRepositoryName
    );

    taskDefinition.addContainer("worker", {
      containerName: resourceName(this, CONSTANTS.ECS.CONTAINER_NAME),
      image: ecs.ContainerImage.fromEcrRepository(
        workerRepository,
        props.imageTag
      ),
      // t4g.nano has 512 MiB; leave headroom for the ECS agent.
      memoryReservationMiB: 256,
      memoryLimitMiB: 400,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: resourceName(this, "worker"),
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        DATABASE_URL: props.databaseUrl,
        IOT_TOPIC: props.iotTopic,
        OREF_URL: CONSTANTS.EXTERNAL.OREF_ALERTS_URL,
        // Poll Oref once per second.
        POLL_INTERVAL_SECONDS: "1",
        AWS_REGION: region,
        AWS_DEFAULT_REGION: region,
      },
    });

    this.service = new ecs.Ec2Service(this, "workerService", {
      serviceName: resourceName(this, CONSTANTS.ECS.SERVICE_NAME),
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      // Single instance: allow the old task to stop before the new one starts.
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      // Fail (and roll back) fast instead of waiting hours if the task can't start.
      circuitBreaker: { rollback: true },
    });

    // An Ec2Service has no implicit dependency on the capacity ASG, so on the
    // FIRST deploy CloudFormation can create the service before any container
    // instance exists. With the deployment circuit breaker enabled that races
    // straight to a "circuit breaker triggered" failure. Force the service to
    // wait until the ASG (and therefore the EC2 instance) is in place so the
    // task has somewhere to be scheduled.
    this.service.node.addDependency(capacity);
  }
}
