import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleKickPlayer } from './game-handlers';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
    const connectionId = event.requestContext.connectionId;
    
    try {
        // Get connection info to find associated game and player
        const connectionResult = await dynamodb.send(new GetCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Key: { connectionId }
        }));
        
        const gracePeriodSeconds = parseInt(process.env.DISCONNECT_GRACE_PERIOD_SECONDS ?? '0', 10);
        const { gameId, playerId } = connectionResult.Item ?? {};

        // If grace period is enabled and connection is associated with a game,
        // write a grace-period marker instead of kicking immediately.
        if (gracePeriodSeconds > 0 && gameId) {
            const expiresAt = Math.floor(Date.now() / 1000) + gracePeriodSeconds;
            await dynamodb.send(new UpdateCommand({
                TableName: process.env.CONNECTIONS_TABLE!,
                Key: { connectionId },
                UpdateExpression: 'SET gracePeriodExpiresAt = :expiresAt',
                ExpressionAttributeValues: { ':expiresAt': expiresAt }
            }));
            return { statusCode: 200 };
        }

        // Grace period disabled or no game association — remove connection and kick immediately.
        await dynamodb.send(new DeleteCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Key: { connectionId }
        }));
        
        if (gameId && playerId) {
            // Use generic kick player function with disconnect reason
            await handleKickPlayer(connectionId, gameId, playerId, playerId, 'disconnect');
        }
        
        return { statusCode: 200 };
    } catch (error) {
        console.error('Disconnect error:', error);
        return { statusCode: 500 };
    }
};
