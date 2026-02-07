#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || 'rgb-daily-challenges';

// Sample prompts - customize as needed
const prompts = [
    { date: '2026-02-07', prompt: 'Lavender fields' },
    { date: '2026-02-08', prompt: 'A calm forest in autumn' },
    { date: '2026-02-09', prompt: 'Ocean waves at midnight' },
    { date: '2026-02-10', prompt: 'Fresh strawberries' },
    { date: '2026-02-11', prompt: 'Morning coffee' },
    { date: '2026-02-12', prompt: 'A cozy fireplace' },
    { date: '2026-02-13', prompt: 'Spring flowers blooming' },
    { date: '2026-02-14', prompt: 'Valentine\'s Day romance' },
    { date: '2026-02-15', prompt: 'Cherry blossoms in spring' },
    { date: '2026-02-16', prompt: 'A tropical sunset' },
    { date: '2026-02-17', prompt: 'Fresh mint leaves' },
    { date: '2026-02-18', prompt: 'A stormy sky' },
    { date: '2026-02-19', prompt: 'Golden hour light' },
    { date: '2026-02-20', prompt: 'Deep sea coral reef' },
];

async function addPrompts() {
    console.log(`Adding ${prompts.length} prompts to ${CHALLENGES_TABLE}...`);

    for (const { date, prompt } of prompts) {
        try {
            await dynamodb.send(new PutCommand({
                TableName: CHALLENGES_TABLE,
                Item: {
                    challengeId: date,
                    prompt: prompt,
                    status: 'queued',
                    validFrom: null,
                    validUntil: null,
                    totalSubmissions: 0,
                    createdAt: new Date().toISOString()
                }
            }));
            console.log(`✓ Added prompt for ${date}: "${prompt}"`);
        } catch (error) {
            console.error(`✗ Failed to add prompt for ${date}:`, error);
        }
    }

    console.log('\nDone!');
}

addPrompts().catch(console.error);
