import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || '';
const PROMPTS_QUEUE_TABLE = process.env.PROMPTS_QUEUE_TABLE || '';

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

        if (existingChallenge.Item) {
            console.log(`Challenge for ${challengeId} already exists`);
            return;
        }

        // Query prompts queue for today's prompt
        const promptResult = await dynamodb.send(new GetCommand({
            TableName: PROMPTS_QUEUE_TABLE,
            Key: { promptId: challengeId }
        }));

        let prompt: string;
        if (promptResult.Item && promptResult.Item.status === 'queued') {
            prompt = promptResult.Item.prompt;

            // Mark prompt as used
            await dynamodb.send(new UpdateCommand({
                TableName: PROMPTS_QUEUE_TABLE,
                Key: { promptId: challengeId },
                UpdateExpression: 'SET #status = :used',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':used': 'used'
                }
            }));
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

        // Create challenge
        await dynamodb.send(new PutCommand({
            TableName: CHALLENGES_TABLE,
            Item: {
                challengeId,
                prompt,
                createdAt: new Date().toISOString(),
                validFrom: validFrom.toISOString(),
                validUntil: validUntil.toISOString(),
                metadata: {
                    totalSubmissions: 0
                },
                status: 'active'
            }
        }));

        console.log(`Successfully created challenge for ${challengeId}: "${prompt}"`);
    } catch (error) {
        console.error('Error creating daily challenge:', error);
        throw error;
    }
};
