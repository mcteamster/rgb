import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

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

    // Daily Challenge Tables
    const dailyChallengesTable = new dynamodb.Table(this, 'DailyChallengesTable', {
      tableName: 'rgb-daily-challenges',
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN // Keep history
    });

    const dailySubmissionsTable = new dynamodb.Table(this, 'DailySubmissionsTable', {
      tableName: 'rgb-daily-submissions',
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl'
    });

    // Add GSIs for leaderboard and user history
    dailySubmissionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING }
    });

    dailySubmissionsTable.addGlobalSecondaryIndex({
      indexName: 'ChallengeLeaderboardIndex',
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'score', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Add GSI for querying queued prompts
    dailyChallengesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING }
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

    // REST API for Daily Challenge
    const dailyChallengeApi = new apigateway.RestApi(this, 'DailyChallengeApi', {
      restApiName: 'RGB Daily Challenge API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS']
      },
      deployOptions: {
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200
      }
    });

    // Daily Challenge Lambda Functions
    const getCurrentChallengeFunction = new lambda.Function(this, 'GetCurrentChallengeFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'get-current-challenge.handler',
      code: lambda.Code.fromAsset('dist/lambda/daily-challenge'),
      role: lambdaExecutionRole,
      environment: {
        CHALLENGES_TABLE: dailyChallengesTable.tableName,
        SUBMISSIONS_TABLE: dailySubmissionsTable.tableName
      }
    });

    const submitChallengeFunction = new lambda.Function(this, 'SubmitChallengeFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'submit-challenge.handler',
      code: lambda.Code.fromAsset('dist/lambda/daily-challenge'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CHALLENGES_TABLE: dailyChallengesTable.tableName,
        SUBMISSIONS_TABLE: dailySubmissionsTable.tableName
      }
    });

    const getLeaderboardFunction = new lambda.Function(this, 'GetLeaderboardFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'get-leaderboard.handler',
      code: lambda.Code.fromAsset('dist/lambda/daily-challenge'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CHALLENGES_TABLE: dailyChallengesTable.tableName,
        SUBMISSIONS_TABLE: dailySubmissionsTable.tableName
      }
    });

    const getUserHistoryFunction = new lambda.Function(this, 'GetUserHistoryFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'get-user-history.handler',
      code: lambda.Code.fromAsset('dist/lambda/daily-challenge'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CHALLENGES_TABLE: dailyChallengesTable.tableName,
        SUBMISSIONS_TABLE: dailySubmissionsTable.tableName
      }
    });

    const createDailyChallengeFunction = new lambda.Function(this, 'CreateDailyChallengeFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'create-daily-challenge.handler',
      code: lambda.Code.fromAsset('dist/lambda/daily-challenge'),
      role: lambdaExecutionRole,
      environment: {
        CHALLENGES_TABLE: dailyChallengesTable.tableName
      }
    });

    // Grant permissions
    dailyChallengesTable.grantReadData(getCurrentChallengeFunction);
    dailySubmissionsTable.grantReadData(getCurrentChallengeFunction);

    dailyChallengesTable.grantReadWriteData(submitChallengeFunction);
    dailySubmissionsTable.grantReadWriteData(submitChallengeFunction);

    dailyChallengesTable.grantReadData(getLeaderboardFunction);
    dailySubmissionsTable.grantReadData(getLeaderboardFunction);

    dailyChallengesTable.grantReadData(getUserHistoryFunction);
    dailySubmissionsTable.grantReadData(getUserHistoryFunction);

    dailyChallengesTable.grantReadWriteData(createDailyChallengeFunction);

    // API Routes
    const dailyChallengeResource = dailyChallengeApi.root.addResource('daily-challenge');

    const currentResource = dailyChallengeResource.addResource('current');
    currentResource.addMethod('GET', new apigateway.LambdaIntegration(getCurrentChallengeFunction));

    const submitResource = dailyChallengeResource.addResource('submit');
    submitResource.addMethod('POST', new apigateway.LambdaIntegration(submitChallengeFunction), {
      methodResponses: [{ statusCode: '200' }],
      requestValidatorOptions: {
        validateRequestBody: true,
        validateRequestParameters: false
      }
    });

    const leaderboardResource = dailyChallengeResource.addResource('leaderboard');
    const leaderboardChallengeResource = leaderboardResource.addResource('{challengeId}');
    leaderboardChallengeResource.addMethod('GET', new apigateway.LambdaIntegration(getLeaderboardFunction));

    const historyResource = dailyChallengeResource.addResource('history');
    const historyUserResource = historyResource.addResource('{userId}');
    historyUserResource.addMethod('GET', new apigateway.LambdaIntegration(getUserHistoryFunction));

    // EventBridge rule for daily challenge creation
    const createChallengeRule = new events.Rule(this, 'CreateDailyChallengeRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0',
        day: '*',
        month: '*',
        year: '*'
      })
    });
    createChallengeRule.addTarget(new targets.LambdaFunction(createDailyChallengeFunction));

    // Output the WebSocket endpoint
    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${domainName}`,
      description: 'WebSocket API URL'
    });

    // Output the REST API endpoint
    new cdk.CfnOutput(this, 'DailyChallengeApiUrl', {
      value: dailyChallengeApi.url,
      description: 'Daily Challenge REST API URL'
    });
  }
}
