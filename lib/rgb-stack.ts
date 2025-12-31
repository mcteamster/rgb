import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class RgbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const gamesTable = new dynamodb.Table(this, 'GamesTable', {
      tableName: 'rgb-games',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'rgb-connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // REST API Gateway
    const api = new apigateway.RestApi(this, 'RgbApi', {
      restApiName: 'RGB Game API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'RgbWebSocketApi', {
      apiName: 'RGB WebSocket API'
    });

    // Lambda Functions
    const createGameFunction = new lambda.Function(this, 'CreateGameFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'create-game.handler',
      code: lambda.Code.fromAsset('lambda/game-management'),
      environment: {
        GAMES_TABLE: gamesTable.tableName
      }
    });

    const joinGameFunction = new lambda.Function(this, 'JoinGameFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'join-game.handler',
      code: lambda.Code.fromAsset('lambda/game-management'),
      environment: {
        GAMES_TABLE: gamesTable.tableName
      }
    });

    // Grant permissions
    gamesTable.grantReadWriteData(createGameFunction);
    gamesTable.grantReadWriteData(joinGameFunction);

    // API Routes
    const gamesResource = api.root.addResource('games');
    gamesResource.addMethod('POST', new apigateway.LambdaIntegration(createGameFunction));
    
    const gameResource = gamesResource.addResource('{gameId}');
    const joinResource = gameResource.addResource('join');
    joinResource.addMethod('POST', new apigateway.LambdaIntegration(joinGameFunction));

    // Output the API endpoints
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: api.url,
      description: 'REST API Gateway URL'
    });

    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketApi.apiId}`,
      description: 'WebSocket API URL'
    });
  }
}
