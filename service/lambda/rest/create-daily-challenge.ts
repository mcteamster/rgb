import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';

export const handler = async (event: EventBridgeEvent<string, any>): Promise<void> => {
    try {
        // Calculate today's challengeId (YYYY-MM-DD in UTC)
        const today = new Date();
        const challengeId = today.toISOString().split('T')[0];

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

        // Calculate validFrom and validUntil
        const validFrom = new Date(today);
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
    } catch (error) {
        console.error('Error creating daily challenge:', error);
        throw error;
    }
};
