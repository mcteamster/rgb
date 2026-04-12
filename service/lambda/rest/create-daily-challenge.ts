import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';

export const handler = async (event: EventBridgeEvent<string, any>): Promise<void> => {
    try {
        // UTC+14 is the first timezone to see a new day (Pacific/Kiritimati, Christmas Island).
        // The EventBridge fires at 10:00 UTC = midnight UTC+14, so the challenge ID is
        // always the date that UTC+14 users are starting, ensuring every timezone has
        // the challenge available when their local day begins.
        const utcPlus14 = new Date(Date.now() + 14 * 60 * 60 * 1000);
        const challengeId = utcPlus14.toISOString().split('T')[0];

        console.log(`Creating daily challenge for ${challengeId}`);

        // Check if challenge already exists (idempotency)
        const existingChallenge = await dynamodb.send(new GetCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId }
        }));

        if (existingChallenge.Item && existingChallenge.Item.status === 'active') {
            console.log(`Challenge for ${challengeId} already active`);
            return;
        }

        // Get prompt (either queued or create new)
        let prompt: string;
        if (existingChallenge.Item && existingChallenge.Item.status === 'queued') {
            prompt = existingChallenge.Item.prompt;
        } else {
            // Fallback prompt if no prompt queued
            prompt = 'A color that makes you happy';
            console.warn(`No prompt queued for ${challengeId}, using fallback`);
        }

        // Calculate validFrom and validUntil (UTC boundaries, kept for reference)
        const validFrom = new Date(utcPlus14);
        validFrom.setUTCHours(0, 0, 0, 0);

        const validUntil = new Date(validFrom);
        validUntil.setUTCDate(validFrom.getUTCDate() + 1);

        // Activate challenge
        await dynamodb.send(new UpdateCommand({
            TableName: CHALLENGES_TABLE,
            Key: { challengeId },
            UpdateExpression: 'SET #status = :active, #prompt = :prompt, validFrom = :from, validUntil = :until, totalSubmissions = :zero, updatedAt = :now',
            ConditionExpression: 'attribute_not_exists(#status) OR #status = :queued',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#prompt': 'prompt'
            },
            ExpressionAttributeValues: {
                ':active': 'active',
                ':queued': 'queued',
                ':prompt': prompt,
                ':from': validFrom.toISOString(),
                ':until': validUntil.toISOString(),
                ':zero': 0,
                ':now': new Date().toISOString()
            }
        }));

        console.log(`Successfully created challenge for ${challengeId}: "${prompt}"`);

        // Mark challenges older than 30 days as inactive.
        // Use Baker Island (UTC-12) as the reference — the last timezone to finish each day —
        // so no currently-playing user is affected when we close off old challenges.
        const bakerIslandNow = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(bakerIslandNow);
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
        const oldChallengeId = thirtyDaysAgo.toISOString().split('T')[0];

        try {
            await dynamodb.send(new UpdateCommand({
                TableName: CHALLENGES_TABLE,
                Key: { challengeId: oldChallengeId },
                UpdateExpression: 'SET #status = :inactive, updatedAt = :now',
                ConditionExpression: 'attribute_exists(challengeId) AND #status = :active',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':inactive': 'inactive',
                    ':active': 'active',
                    ':now': new Date().toISOString()
                }
            }));
            console.log(`Marked challenge ${oldChallengeId} as inactive`);
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                console.log(`Challenge ${oldChallengeId} already inactive or doesn't exist`);
            } else {
                console.error(`Error marking old challenge inactive:`, error);
            }
        }
    } catch (error) {
        console.error('Error creating daily challenge:', error);
        throw error;
    }
};
