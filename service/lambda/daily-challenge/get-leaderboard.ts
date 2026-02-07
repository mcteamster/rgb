import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const challengeId = event.pathParameters?.challengeId;
        if (!challengeId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing challengeId' })
            };
        }

        const userId = event.queryStringParameters?.userId;
        const limit = parseInt(event.queryStringParameters?.limit || '100');

        // Get challenge metadata
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

        // Query top scores using GSI (sorted by score desc)
        const leaderboardResult = await dynamodb.send(new QueryCommand({
            TableName: SUBMISSIONS_TABLE,
            IndexName: 'ChallengeLeaderboardIndex',
            KeyConditionExpression: 'challengeId = :challengeId',
            ExpressionAttributeValues: {
                ':challengeId': challengeId
            },
            ScanIndexForward: false, // Descending order (highest scores first)
            Limit: limit
        }));

        const topScores = (leaderboardResult.Items || []).map((item, index) => ({
            rank: index + 1,
            userName: item.userName,
            score: item.score,
            submittedColor: item.submittedColor
        }));

        // If userId provided, get their submission and calculate rank
        let yourSubmission = null;
        if (userId) {
            const userSubmissionResult = await dynamodb.send(new GetCommand({
                TableName: SUBMISSIONS_TABLE,
                Key: { challengeId, userId }
            }));

            if (userSubmissionResult.Item) {
                const userItem = userSubmissionResult.Item;

                // Count how many submissions have higher scores
                const rankResult = await dynamodb.send(new QueryCommand({
                    TableName: SUBMISSIONS_TABLE,
                    IndexName: 'ChallengeLeaderboardIndex',
                    KeyConditionExpression: 'challengeId = :challengeId AND score > :score',
                    ExpressionAttributeValues: {
                        ':challengeId': challengeId,
                        ':score': userItem.score
                    },
                    Select: 'COUNT'
                }));

                const rank = (rankResult.Count || 0) + 1;

                yourSubmission = {
                    rank,
                    score: userItem.score,
                    submittedColor: userItem.submittedColor,
                    distanceFromAverage: userItem.distanceFromAverage
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
                status: challenge.status,
                totalSubmissions: challenge.metadata?.totalSubmissions || 0,
                topScores,
                yourSubmission
            })
        };
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to fetch leaderboard' })
        };
    }
};
