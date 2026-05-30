// apigateway_service.ts - HTTP API in front of the API Lambda.

import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as CONSTANTS from "../constants";
import { resourceName } from "./naming";

export interface ApiGatewayServiceProps {
  /** The API Lambda to route all requests to. */
  readonly apiFunction: lambda.IFunction;
}

export class ApiGatewayService extends Construct {
  public readonly httpApi: apigwv2.HttpApi;
  /** Origin domain CloudFront uses for the /api/* behavior. */
  public readonly apiOriginDomain: string;

  constructor(scope: Construct, id: string, props: ApiGatewayServiceProps) {
    super(scope, id);

    const integration = new HttpLambdaIntegration(
      "apiIntegration",
      props.apiFunction
    );

    // $default route forwards everything to the Lambda; FastAPI/Mangum routes by path.
    this.httpApi = new apigwv2.HttpApi(this, "httpApi", {
      apiName: resourceName(this, CONSTANTS.API_GATEWAY.API_NAME),
      defaultIntegration: integration,
    });

    const { region } = Stack.of(this);
    this.apiOriginDomain = `${this.httpApi.apiId}.execute-api.${region}.amazonaws.com`;
  }
}
