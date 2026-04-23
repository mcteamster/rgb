import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ANALYTICS_BUCKET = process.env.ANALYTICS_BUCKET || '';
const REGION = process.env.AWS_REGION || 'unknown';

// Use eu-central-1 since the analytics bucket lives in the DailyChallengeStack
const s3Client = new S3Client({ region: 'eu-central-1' });

interface RoundRecord {
    gameId: string;
    region: string;
    roundIndex: number;
    playerCount: number;
    targetColor: { h: number; s: number; l: number };
    description: string | null;
    describerId: string;
    submissions: Record<string, { h: number; s: number; l: number }>;
    scores: Record<string, number>;
    completedAt: string;
}

export async function writeRoundToS3(game: any, roundIndex: number): Promise<void> {
    if (!ANALYTICS_BUCKET) return;

    const round = game.gameplay.rounds[roundIndex];
    if (!round) return;

    const record: RoundRecord = {
        gameId: game.gameId,
        region: REGION,
        roundIndex,
        playerCount: game.players?.length || 0,
        targetColor: round.targetColor,
        description: round.description ?? null,
        describerId: round.describerId,
        submissions: round.submissions || {},
        scores: round.scores || {},
        completedAt: new Date().toISOString()
    };

    const now = new Date();
    const key = `multiplayer/year=${now.getUTCFullYear()}/month=${String(now.getUTCMonth() + 1).padStart(2, '0')}/day=${String(now.getUTCDate()).padStart(2, '0')}/${game.gameId}-r${roundIndex}-${Date.now()}.json`;

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: ANALYTICS_BUCKET,
            Key: key,
            Body: JSON.stringify(record),
            ContentType: 'application/json'
        }));
        console.log(`Wrote round analytics to s3://${ANALYTICS_BUCKET}/${key}`);
    } catch (error) {
        // Don't fail the game flow if analytics write fails
        console.error('Failed to write round analytics:', error);
    }
}
