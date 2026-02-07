#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || 'rgb-daily-challenges';

async function createChallenge(challengeId: string, prompt: string) {
    console.log(`Creating challenge for ${challengeId}...`);

    // Check if challenge already exists
    const existingChallenge = await dynamodb.send(new GetCommand({
        TableName: CHALLENGES_TABLE,
        Key: { challengeId }
    }));

    if (existingChallenge.Item) {
        console.error(`✗ Challenge for ${challengeId} already exists`);
        return;
    }

    // Calculate validFrom and validUntil
    const validFrom = new Date(challengeId);
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

    console.log(`✓ Successfully created challenge for ${challengeId}: "${prompt}"`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let date = '';
let prompt = '';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
        date = args[i + 1];
        i++;
    } else if (args[i] === '--prompt' && args[i + 1]) {
        prompt = args[i + 1];
        i++;
    }
}

if (!date || !prompt) {
    console.error('Usage: npm run create-challenge -- --date YYYY-MM-DD --prompt "Your prompt text"');
    process.exit(1);
}

createChallenge(date, prompt).catch(console.error);
