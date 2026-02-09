import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

interface RgbStackProps extends cdk.StackProps {
  endpoints: { [region: string]: string };
}

export class RgbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RgbStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const gamesTable = new dynamodb.Table(this, 'GamesTable', {
      tableName: 'rgb-games',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl'
    });

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'rgb-connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl'
    });

    // Add GSI for querying connections by gameId
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'GameIdIndex',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING }
    });

    // WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'RgbWebSocketApi', {
      apiName: 'RGB WebSocket API'
    });

    const webSocketStage = new apigatewayv2.WebSocketStage(this, 'RgbWebSocketStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true
    });

    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: '*.rgb.mcteamster.com',
      validation: certificatemanager.CertificateValidation.fromDns(),
    });

    // Export certificate ARN for use in other stacks
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      exportName: 'RgbCertificateArn'
    });

    const domainName = props.endpoints[this.region];
    const apiDomainName = new apigatewayv2.DomainName(this, 'ApiDomainName', {
      domainName: domainName,
      certificate: certificate,
    });

    new apigatewayv2.ApiMapping(this, 'ApiMapping', {
      api: webSocketApi,
      stage: webSocketStage,
      domainName: apiDomainName,
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { 
      domainName: 'mcteamster.com',
    });

    new route53.ARecord(this, 'ApiRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: apiDomainName.regionalDomainName,
          hostedZoneId: apiDomainName.regionalHostedZoneId
        })
      })
    });

    // Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        LambdaExecutionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: ['arn:aws:logs:*:*:*']
            })
          ]
        })
      }
    });

    // WebSocket Lambda Functions
    const connectFunction = new lambda.Function(this, 'ConnectFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'connect.handler',
      code: lambda.Code.fromAsset('dist/lambda/websocket'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName
      }
    });

    const disconnectFunction = new lambda.Function(this, 'DisconnectFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'disconnect.handler',
      code: lambda.Code.fromAsset('dist/lambda/websocket'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName
      }
    });

    const messageFunction = new lambda.Function(this, 'MessageFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'message.handler',
      code: lambda.Code.fromAsset('dist/lambda/websocket'),
      role: lambdaExecutionRole,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        GAMES_TABLE: gamesTable.tableName,
        WEBSOCKET_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`
      }
    });

    // Grant permissions
    gamesTable.grantReadWriteData(messageFunction);
    connectionsTable.grantReadWriteData(connectFunction);
    connectionsTable.grantReadWriteData(disconnectFunction);
    connectionsTable.grantReadWriteData(messageFunction);

    // Grant WebSocket API permissions to message function
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/*`]
    }));

    // WebSocket Routes
    webSocketApi.addRoute('$connect', {
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('ConnectIntegration', connectFunction)
    });

    webSocketApi.addRoute('$disconnect', {
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('DisconnectIntegration', disconnectFunction)
    });

    webSocketApi.addRoute('$default', {
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('MessageIntegration', messageFunction)
    });

    // Output the WebSocket endpoint
    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${domainName}`,
      description: 'WebSocket API URL'
    });
  }
}
