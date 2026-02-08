#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const CHALLENGES_TABLE = process.env.CHALLENGES_TABLE || 'rgb-daily-challenges';

async function createChallenge(challengeId: string, prompt: string, status: 'active' | 'queued' = 'active') {
    const existingChallenge = await dynamodb.send(new GetCommand({
        TableName: CHALLENGES_TABLE,
        Key: { challengeId }
    }));

    if (existingChallenge.Item) {
        console.error(`✗ Challenge for ${challengeId} already exists`);
        return false;
    }

    const now = new Date().toISOString();
    let validFrom = null;
    let validUntil = null;

    if (status === 'active') {
        const fromDate = new Date(challengeId);
        fromDate.setUTCHours(0, 0, 0, 0);
        validFrom = fromDate.toISOString();

        const untilDate = new Date(fromDate);
        untilDate.setUTCDate(fromDate.getUTCDate() + 1);
        validUntil = untilDate.toISOString();
    }

    await dynamodb.send(new PutCommand({
        TableName: CHALLENGES_TABLE,
        Item: {
            challengeId,
            prompt,
            status,
            validFrom,
            validUntil,
            totalSubmissions: 0,
            averageColor: null,
            componentStats: null,
            createdAt: now,
            updatedAt: now
        }
    }));

    console.log(`✓ ${status === 'active' ? 'Created' : 'Queued'} challenge for ${challengeId}: "${prompt}"`);
    return true;
}

async function addPrompts(prompts: Array<{ date: string; prompt: string }>) {
    console.log(`Adding ${prompts.length} prompts to ${CHALLENGES_TABLE}...\n`);
    
    let success = 0;
    let failed = 0;

    for (const { date, prompt } of prompts) {
        try {
            const result = await createChallenge(date, prompt, 'queued');
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`✗ Failed to add prompt for ${date}:`, error);
            failed++;
        }
    }

    console.log(`\nDone! ${success} added, ${failed} failed.`);
}

function showUsage() {
    console.log(`
Usage:
  npm run manage-challenges -- create --date YYYY-MM-DD --prompt "Your prompt"
  npm run manage-challenges -- queue --date YYYY-MM-DD --prompt "Your prompt"
  npm run manage-challenges -- bulk --file prompts.json

Commands:
  create  Create and activate a challenge immediately
  queue   Queue a challenge for future activation
  bulk    Add multiple queued prompts from JSON file

Options:
  --date     Challenge date (YYYY-MM-DD)
  --prompt   Challenge prompt text
  --file     JSON file with prompts (format: [{"date": "YYYY-MM-DD", "prompt": "text"}])

Examples:
  npm run manage-challenges -- create --date 2026-02-10 --prompt "Sunset colors"
  npm run manage-challenges -- queue --date 2026-02-15 --prompt "Ocean waves"
  npm run manage-challenges -- bulk --file prompts.json
`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === '--help' || command === '-h') {
        showUsage();
        process.exit(0);
    }

    if (command === 'create' || command === 'queue') {
        let date = '';
        let prompt = '';

        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--date' && args[i + 1]) {
                date = args[i + 1];
                i++;
            } else if (args[i] === '--prompt' && args[i + 1]) {
                prompt = args[i + 1];
                i++;
            }
        }

        if (!date || !prompt) {
            console.error('Error: --date and --prompt are required\n');
            showUsage();
            process.exit(1);
        }

        await createChallenge(date, prompt, command === 'create' ? 'active' : 'queued');
    } else if (command === 'bulk') {
        let file = '';

        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--file' && args[i + 1]) {
                file = args[i + 1];
                i++;
            }
        }

        if (!file) {
            console.error('Error: --file is required\n');
            showUsage();
            process.exit(1);
        }

        try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(file, 'utf-8');
            const prompts = JSON.parse(content);

            if (!Array.isArray(prompts)) {
                console.error('Error: JSON file must contain an array of {date, prompt} objects');
                process.exit(1);
            }

            await addPrompts(prompts);
        } catch (error) {
            console.error('Error reading file:', error);
            process.exit(1);
        }
    } else {
        console.error(`Unknown command: ${command}\n`);
        showUsage();
        process.exit(1);
    }
}

main().catch(console.error);
