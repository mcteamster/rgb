import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const challengeId = event.pathParameters?.date;
        const userId = event.queryStringParameters?.userId;

        if (!challengeId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Date parameter required' })
            };
        }

        // Get challenge
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
                body: JSON.stringify({ error: 'Challenge not found' })
            };
        }

        const challenge = challengeResult.Item;

        // Check if challenge is older than 30 days
        const challengeDate = new Date(challengeId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (challengeDate < thirtyDaysAgo) {
            return {
                statusCode: 410,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Challenge is older than 30 days and no longer available' })
            };
        }

        // If userId provided, check if they've submitted
        let userSubmission = null;
        if (userId) {
            const submissionResult = await dynamodb.send(new GetCommand({
                TableName: SUBMISSIONS_TABLE,
                Key: { userId, challengeId }
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
                challenge: {
                    challengeId: challenge.challengeId,
                    prompt: challenge.prompt,
                    status: challenge.status,
                    validFrom: challenge.validFrom,
                    validUntil: challenge.validUntil
                },
                userSubmission
            })
        };
    } catch (error) {
        console.error('Error getting challenge:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
