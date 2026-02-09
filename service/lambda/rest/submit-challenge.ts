import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { HSLColor, updateAverageColor, distanceFromAverageScoring } from './scoring';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || '';

interface SubmissionRequest {
    challengeId: string;
    userId: string;
    userName: string;
    color: HSLColor;
    fingerprint: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing request body' })
            };
        }

        const submission: SubmissionRequest = JSON.parse(event.body);

        // Validate required fields
        if (!submission.challengeId || !submission.userId || !submission.color) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Validate HSL color values
        const { h, s, l } = submission.color;
        if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number' ||
            h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100 ||
            !isFinite(h) || !isFinite(s) || !isFinite(l)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Invalid color values. H: 0-360, S: 0-100, L: 0-100' })
            };
        }

        // Validate userName length if provided
        if (submission.userName && (submission.userName.length > 50 || submission.userName.length < 1)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'userName must be 1-50 characters' })
            };
        }

        // Validate challenge exists and is active
        const challengeResult = await dynamodb.send(new GetCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId: submission.challengeId }
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

        // Check if challenge is still active
        const now = new Date();
        const validUntil = new Date(challenge.validUntil);
        if (now > validUntil) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Challenge has expired' })
            };
        }

        const existingCount = challenge.totalSubmissions || 0;
        const previousAverage = challenge.averageColor;
        const previousStats = challenge.componentStats;

        let averageColor: HSLColor;
        let componentStats: any;
        let score: number;
        let distance: number;

        // First two submissions get full points
        if (existingCount < 2) {
            const result = updateAverageColor(submission.color, 0, submission.color);
            averageColor = result.averageColor;
            componentStats = result.stats;
            score = 100;
            distance = 0;
        } else {
            // Incrementally update average with new submission
            const result = updateAverageColor(previousAverage, existingCount, submission.color, previousStats);
            averageColor = result.averageColor;
            componentStats = result.stats;
            const scoreResult = distanceFromAverageScoring(submission.color, averageColor);
            score = scoreResult.score;
            distance = scoreResult.distance;
        }

        // Store submission with TTL (30 days) - use conditional write to prevent duplicates
        const submittedAt = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

        try {
            await dynamodb.send(new PutCommand({
                TableName: SUBMISSIONS_TABLE,
                Item: {
                    userId: submission.userId,
                    challengeId: submission.challengeId,
                    userName: submission.userName || 'Anonymous',
                    submittedColor: submission.color,
                    submittedAt,
                    score,
                    averageAtSubmission: averageColor,
                    distanceFromAverage: distance,
                    fingerprint: submission.fingerprint,
                    ttl
                },
                ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(challengeId)'
            }));
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: "You've already submitted today" })
                };
            }
            throw error;
        }

        // Update challenge metadata (increment totalSubmissions and update averageColor)
        await dynamodb.send(new UpdateCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId: submission.challengeId },
            UpdateExpression: 'SET totalSubmissions = if_not_exists(totalSubmissions, :zero) + :inc, averageColor = :avgColor, componentStats = :stats',
            ExpressionAttributeValues: {
                ':inc': 1,
                ':zero': 0,
                ':avgColor': averageColor,
                ':stats': componentStats
            }
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                submission: {
                    challengeId: submission.challengeId,
                    score,
                    distanceFromAverage: distance,
                    averageColor,
                    submittedAt
                }
            })
        };
    } catch (error) {
        console.error('Error submitting challenge:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to submit challenge' })
        };
    }
};
