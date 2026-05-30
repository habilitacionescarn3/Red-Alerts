// lambda_service.ts - the API Lambda plus its two layers (common deps + backend code).

import * as path from "path";
import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as CONSTANTS from "../constants";

export interface LambdaServiceProps {
  /** Execution role for the API Lambda. */
  readonly apiRole: iam.IRole;
  /** The existing VPC that hosts the (private) MySQL database. */
  readonly vpc: ec2.IVpc;
  /** Subnets to place the Lambda ENIs in. */
  readonly vpcSubnets: ec2.SubnetSelection;
  /** Shared security group applied to the Lambda ENIs (DB reachability). */
  readonly securityGroup: ec2.ISecurityGroup;
  /** Full MySQL connection URL (secret) passed straight to the function. */
  readonly databaseUrl: string;
}

const SERVER_ROOT = path.join(__dirname, "..");
const COMMON_LAYER_DIR = path.join(
  SERVER_ROOT,
  "resources",
  "dependencies_layers",
  "common-layer"
);

export class LambdaService extends Construct {
  /** The API Lambda (FastAPI + Mangum). */
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaServiceProps) {
    super(scope, id);

    // backend-code-layer: our shared Python codebase (layer/python/codebase).
    const backendCodeLayer = new lambda.LayerVersion(this, "backendCodeLayer", {
      code: lambda.Code.fromAsset(path.join(SERVER_ROOT, "layer")),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      layerVersionName: "red-alerts-backend-code-layer",
      description: "Shared Red Alerts backend codebase (Python).",
    });

    // common-layer: heavy third-party deps. CDK builds it from requirements.txt
    // by pip-installing into the layer's python/ dir inside the Lambda build
    // image (so arm64 wheels match the runtime). Requires Docker at deploy time
    // (already needed for the worker image asset).
    const commonLayer = new lambda.LayerVersion(this, "commonLayer", {
      layerVersionName: CONSTANTS.LAMBDA_CONFIG.COMMON_LAYER_NAME,
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      description: "Red Alerts third-party Python deps (fastapi, mangum, pymysql, ...).",
      code: lambda.Code.fromAsset(COMMON_LAYER_DIR, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          platform: "linux/arm64",
          command: [
            "bash",
            "-c",
            "pip install -r requirements.txt -t /asset-output/python",
          ],
        },
      }),
    });

    const layers: lambda.ILayerVersion[] = [commonLayer, backendCodeLayer];

    this.apiFunction = new lambda.Function(this, "api", {
      functionName: "red-alerts-api",
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(
        path.join(SERVER_ROOT, CONSTANTS.RESOURCES_FOLDER_NAME, "lambda", "api")
      ),
      handler: "api.handler",
      role: props.apiRole,
      layers,
      // Attach to the database VPC so the API can reach the private MySQL
      // instance. The chosen subnets need NAT egress for SSM/IoT/internet.
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      securityGroups: [props.securityGroup],
      memorySize: CONSTANTS.LAMBDA_CONFIG.DEFAULT_MEMORY,
      timeout: Duration.seconds(CONSTANTS.LAMBDA_CONFIG.DEFAULT_TIMEOUT),
      environment: {
        DATABASE_URL: props.databaseUrl,
      },
      description: "Red Alerts read API (health + recent alerts).",
    });
  }
}
