import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export class DailyChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const dailyChallengesTable = new dynamodb.Table(this, 'DailyChallengesTable', {
      tableName: 'rgb-daily-challenges',
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    dailyChallengesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING }
    });

    const dailySubmissionsTable = new dynamodb.Table(this, 'DailySubmissionsTable', {
      tableName: 'rgb-daily-submissions',
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl'
    });

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

    // Lambda Execution Role
    const lambdaExecutionRole = new iam.Role(this, 'DailyChallengeLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Certificate for custom domain
    const certificate = new certificatemanager.Certificate(this, 'ApiCertificate', {
      domainName: 'api.rgb.mcteamster.com',
      validation: certificatemanager.CertificateValidation.fromDns()
    });

    // REST API
    const api = new apigateway.RestApi(this, 'DailyChallengeApi', {
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

    // Custom domain
    const customDomain = new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: 'api.rgb.mcteamster.com',
      certificate: certificate,
      endpointType: apigateway.EndpointType.REGIONAL
    });

    customDomain.addBasePathMapping(api, {
      basePath: ''
    });

    // Route53 DNS record
    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', {
      domainName: 'mcteamster.com'
    });

    new route53.ARecord(this, 'ApiAliasRecord', {
      zone: hostedZone,
      recordName: 'api.rgb',
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: customDomain.domainNameAliasDomainName,
          hostedZoneId: customDomain.domainNameAliasHostedZoneId
        })
      })
    });

    // Lambda Functions
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

    // Grant Permissions
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
    const dailyChallengeResource = api.root.addResource('daily-challenge');

    const currentResource = dailyChallengeResource.addResource('current');
    currentResource.addMethod('GET', new apigateway.LambdaIntegration(getCurrentChallengeFunction));

    const submitResource = dailyChallengeResource.addResource('submit');
    submitResource.addMethod('POST', new apigateway.LambdaIntegration(submitChallengeFunction));

    const leaderboardResource = dailyChallengeResource.addResource('leaderboard');
    const leaderboardChallengeResource = leaderboardResource.addResource('{challengeId}');
    leaderboardChallengeResource.addMethod('GET', new apigateway.LambdaIntegration(getLeaderboardFunction));

    const historyResource = dailyChallengeResource.addResource('history');
    const historyUserResource = historyResource.addResource('{userId}');
    historyUserResource.addMethod('GET', new apigateway.LambdaIntegration(getUserHistoryFunction));

    // EventBridge Rule for Daily Challenge Creation
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

    // Outputs
    new cdk.CfnOutput(this, 'DailyChallengeApiUrl', {
      value: `https://api.rgb.mcteamster.com`,
      description: 'Daily Challenge API URL'
    });

    new cdk.CfnOutput(this, 'DailyChallengeApiId', {
      value: api.restApiId,
      description: 'Daily Challenge API ID'
    });

    new cdk.CfnOutput(this, 'ChallengesTableName', {
      value: dailyChallengesTable.tableName,
      description: 'Daily Challenges Table Name'
    });

    new cdk.CfnOutput(this, 'SubmissionsTableName', {
      value: dailySubmissionsTable.tableName,
      description: 'Daily Submissions Table Name'
    });
  }
}
