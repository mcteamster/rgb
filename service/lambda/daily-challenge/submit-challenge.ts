import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { HSLColor, calculateAverageColor, distanceFromAverageScoring } from '../websocket/scoring';

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
        if (!submission.challengeId || !submission.userId || !submission.userName || !submission.color) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
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

        // Check if user has already submitted
        const existingSubmission = await dynamodb.send(new GetCommand({
            TableName: SUBMISSIONS_TABLE,
            Key: { challengeId: submission.challengeId, userId: submission.userId }
        }));

        if (existingSubmission.Item) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "You've already submitted today" })
            };
        }

        // Query all existing submissions for this challenge
        const existingSubmissionsResult = await dynamodb.send(new QueryCommand({
            TableName: SUBMISSIONS_TABLE,
            KeyConditionExpression: 'challengeId = :challengeId',
            ExpressionAttributeValues: {
                ':challengeId': submission.challengeId
            }
        }));

        const existingColors: HSLColor[] = (existingSubmissionsResult.Items || []).map(item => item.submittedColor);

        // Calculate current average (before this submission)
        const averageColor = calculateAverageColor(existingColors);

        // Score the new submission against the average
        const { score, distance } = distanceFromAverageScoring(submission.color, averageColor);

        // Store submission with TTL (30 days)
        const submittedAt = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

        await dynamodb.send(new PutCommand({
            TableName: SUBMISSIONS_TABLE,
            Item: {
                challengeId: submission.challengeId,
                userId: submission.userId,
                userName: submission.userName,
                submittedColor: submission.color,
                submittedAt,
                score,
                averageAtSubmission: averageColor,
                distanceFromAverage: distance,
                fingerprint: submission.fingerprint,
                ttl
            }
        }));

        // Update challenge metadata (increment totalSubmissions)
        await dynamodb.send(new UpdateCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId: submission.challengeId },
            UpdateExpression: 'SET metadata.totalSubmissions = if_not_exists(metadata.totalSubmissions, :zero) + :inc',
            ExpressionAttributeValues: {
                ':inc': 1,
                ':zero': 0
            }
        }));

        // Calculate rank (count submissions with higher scores)
        const rankResult = await dynamodb.send(new QueryCommand({
            TableName: SUBMISSIONS_TABLE,
            IndexName: 'ChallengeLeaderboardIndex',
            KeyConditionExpression: 'challengeId = :challengeId AND score >= :score',
            ExpressionAttributeValues: {
                ':challengeId': submission.challengeId,
                ':score': score
            },
            Select: 'COUNT'
        }));

        const rank = rankResult.Count || 1;

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
                    rank,
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
