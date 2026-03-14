import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing userId' })
            };
        }

        const limit = Math.min(parseInt(event.queryStringParameters?.limit || '30'), 100);

        // Query user's submissions (no longer needs GSI)
        const submissionsResult = await dynamodb.send(new QueryCommand({
            TableName: SUBMISSIONS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit
        }));

        const items = submissionsResult.Items || [];
        
        if (items.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    userId,
                    submissions: [],
                    stats: {
                        totalPlayed: 0,
                        averageScore: 0,
                        bestScore: 0,
                        currentStreak: 0
                    }
                })
            };
        }

        // Batch get challenge details (max 100 items per batch)
        const challengeIds = [...new Set(items.map(item => item.challengeId))];
        const challengesResult = await dynamodb.send(new BatchGetCommand({
            RequestItems: {
                [CHALLENGES_TABLE]: {
                    Keys: challengeIds.map(id => ({ challengeId: id }))
                }
            }
        }));

        const challengesMap = new Map(
            (challengesResult.Responses?.[CHALLENGES_TABLE] || []).map(c => [c.challengeId, c])
        );

        const submissions = items.map(item => {
            const challenge = challengesMap.get(item.challengeId);
            return {
                challengeId: item.challengeId,
                prompt: challenge?.prompt || 'Unknown',
                submittedColor: item.submittedColor,
                averageAtSubmission: item.averageAtSubmission,
                score: item.score,
                totalSubmissions: challenge?.totalSubmissions || 0,
                submittedAt: item.submittedAt
            };
        });

        // Calculate aggregate statistics
        const stats = {
            totalPlayed: submissions.length,
            averageScore: submissions.length > 0
                ? submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length
                : 0,
            bestScore: submissions.length > 0
                ? Math.max(...submissions.map(s => s.score))
                : 0,
            currentStreak: calculateStreak(submissions.map(s => ({ challengeId: s.challengeId, submittedAt: s.submittedAt })))
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                userId,
                submissions,
                stats
            })
        };
    } catch (error) {
        console.error('Error fetching user history:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to fetch user history' })
        };
    }
};

function calculateStreak(submissions: { challengeId: string; submittedAt: string }[]): number {
    if (submissions.length === 0) return 0;

    const sortedSubmissions = [...submissions].sort((a, b) => b.challengeId.localeCompare(a.challengeId));

    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < sortedSubmissions.length; i++) {
        const expectedDate = new Date(todayStr);
        expectedDate.setUTCDate(expectedDate.getUTCDate() - i);
        const expectedId = expectedDate.toISOString().split('T')[0];

        const submission = sortedSubmissions[i];
        if (submission.challengeId !== expectedId) break;

        // Verify the submission was actually made on that day (UTC)
        const submittedDay = submission.submittedAt?.split('T')[0];
        if (submittedDay !== expectedId) break;

        streak++;
    }

    return streak;
}
