import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { handleKickPlayer } from './game-handlers';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

/**
 * Scheduled Lambda handler — scans the connections table for expired grace-period
 * records and permanently evicts those players by calling handleKickPlayer.
 *
 * Scan uses a FilterExpression instead of a GSI because the expected table size is
 * small (tens to low hundreds of concurrent connections).  See design.md §D3 for
 * the upgrade path if scan latency becomes a concern at scale.
 */
export const handler = async (): Promise<void> => {
    const nowEpoch = Math.floor(Date.now() / 1000);

    const scanResult = await dynamodb.send(new ScanCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        FilterExpression: 'attribute_exists(gracePeriodExpiresAt) AND gracePeriodExpiresAt < :now',
        ExpressionAttributeValues: {
            ':now': nowEpoch
        }
    }));

    const expiredRecords = scanResult.Items ?? [];

    for (const record of expiredRecords) {
        const { connectionId, gameId, playerId } = record;

        if (!connectionId || !gameId || !playerId) {
            // Incomplete record — skip but don't crash the whole sweep
            console.warn('Sweeper: skipping incomplete grace-period record', record);
            continue;
        }

        try {
            await handleKickPlayer(connectionId, gameId, playerId, playerId, 'disconnect');
        } catch (err) {
            // handleKickPlayer returns 404 for players already removed — that's fine.
            // Log other errors but continue processing remaining records.
            console.error(`Sweeper: handleKickPlayer failed for connectionId=${connectionId}`, err);
        }

        try {
            await dynamodb.send(new DeleteCommand({
                TableName: process.env.CONNECTIONS_TABLE!,
                Key: { connectionId }
            }));
        } catch (err) {
            console.error(`Sweeper: failed to delete connection record connectionId=${connectionId}`, err);
        }
    }
};
