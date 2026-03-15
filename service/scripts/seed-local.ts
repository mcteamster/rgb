/**
 * Creates DynamoDB Local tables and seeds today's daily challenge.
 *
 * Run once after starting DynamoDB Local:
 *   docker compose up -d
 *   npm run seed
 *
 * Safe to re-run — skips tables and challenge entries that already exist.
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:8000';

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const dynamodb = DynamoDBDocumentClient.from(client);

// ── Helpers ────────────────────────────────────────────────────────────────

async function tableExists(name: string): Promise<boolean> {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  return TableNames?.includes(name) ?? false;
}

async function createTableIfNotExists(params: ConstructorParameters<typeof CreateTableCommand>[0]) {
  const name = params.TableName!;
  if (await tableExists(name)) {
    console.log(`  ✓ ${name} (exists)`);
    return;
  }
  await client.send(new CreateTableCommand(params));
  console.log(`  + ${name} (created)`);
}

// ── Table definitions — match CDK stack exactly ────────────────────────────

async function createTables() {
  console.log('\nCreating tables...');

  // rgb-connections: WebSocket connection tracking with GameIdIndex GSI
  // CDK uses PAY_PER_REQUEST — no ProvisionedThroughput on table or GSI
  await createTableIfNotExists({
    TableName: 'rgb-connections',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'connectionId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'connectionId', AttributeType: 'S' },
      { AttributeName: 'gameId',       AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'GameIdIndex',
      KeySchema: [{ AttributeName: 'gameId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  });

  // rgb-games: full game state, keyed by gameId
  await createTableIfNotExists({
    TableName: 'rgb-games',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'gameId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'gameId', AttributeType: 'S' }],
  });

  // rgb-daily-challenges: one entry per YYYY-MM-DD
  await createTableIfNotExists({
    TableName: 'rgb-daily-challenges',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'challengeId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'challengeId', AttributeType: 'S' }],
  });

  // rgb-daily-user-submissions: userId (PK) + challengeId (SK)
  await createTableIfNotExists({
    TableName: 'rgb-daily-user-submissions',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'userId',      KeyType: 'HASH' },
      { AttributeName: 'challengeId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',      AttributeType: 'S' },
      { AttributeName: 'challengeId', AttributeType: 'S' },
    ],
  });
}

// ── Seed today's daily challenge ───────────────────────────────────────────

const SAMPLE_PROMPTS = [
  'Morning Coffee', 'Ocean Breeze', 'Forest Floor', 'Sunset on Mars',
  'Fresh Linen',    'Neon City',    'Autumn Leaves', 'Frozen Tundra',
  'Deep Sea',       'Candlelight',  'Summer Storm',  'Golden Hour',
];

async function seedChallenge() {
  const today = new Date();
  const challengeId = today.toISOString().split('T')[0]; // YYYY-MM-DD

  const validFrom  = new Date(today);
  validFrom.setUTCHours(0, 0, 0, 0);
  const validUntil = new Date(validFrom);
  validUntil.setUTCDate(validUntil.getUTCDate() + 1);

  // Deterministic prompt based on day-of-year (stable across re-runs)
  const start      = new Date(today.getFullYear(), 0, 0);
  const dayOfYear  = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const prompt     = SAMPLE_PROMPTS[dayOfYear % SAMPLE_PROMPTS.length];

  console.log(`\nSeeding challenge for ${challengeId}...`);
  console.log(`  Prompt: "${prompt}"`);

  try {
    await dynamodb.send(new PutCommand({
      TableName: 'rgb-daily-challenges',
      Item: {
        challengeId,
        prompt,
        validFrom:        validFrom.toISOString(),
        validUntil:       validUntil.toISOString(),
        totalSubmissions: 0,
        averageColor:     null,
        colorSum:         null,
      },
      ConditionExpression: 'attribute_not_exists(challengeId)',
    }));
    console.log('  ✓ Seeded');
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      console.log('  ✓ Already seeded');
    } else {
      throw err;
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log(`DynamoDB Local: ${ENDPOINT}`);
await createTables();
await seedChallenge();
console.log('\nDone. Next: npm run dev:service\n');
