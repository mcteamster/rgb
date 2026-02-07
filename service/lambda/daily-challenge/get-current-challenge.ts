import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Calculate today's challengeId (YYYY-MM-DD in UTC)
        const today = new Date();
        const challengeId = today.toISOString().split('T')[0];

        // Get userId from query string
        const userId = event.queryStringParameters?.userId;

        // Query challenges table for today's challenge
        const challengeResult = await dynamodb.send(new GetCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId }
        }));

        if (!challengeResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'No challenge available for today' })
            };
        }

        const challenge = challengeResult.Item;

        // If userId provided, check if they've submitted
        let userSubmission = null;
        if (userId) {
            const submissionResult = await dynamodb.send(new GetCommand({
                TableName: SUBMISSIONS_TABLE,
                Key: { challengeId, userId }
            }));

            if (submissionResult.Item) {
                userSubmission = {
                    color: submissionResult.Item.submittedColor,
                    score: submissionResult.Item.score,
                    submittedAt: submissionResult.Item.submittedAt
                };
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                challengeId: challenge.challengeId,
                prompt: challenge.prompt,
                validFrom: challenge.validFrom,
                validUntil: challenge.validUntil,
                totalSubmissions: challenge.metadata?.totalSubmissions || 0,
                userSubmission
            })
        };
    } catch (error) {
        console.error('Error fetching current challenge:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to fetch current challenge' })
        };
    }
};
