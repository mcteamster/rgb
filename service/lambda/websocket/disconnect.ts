import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
        
        // Remove the connection record
        await dynamodb.send(new DeleteCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Key: { connectionId }
        }));
        
        if (connectionResult.Item?.gameId && connectionResult.Item?.playerId) {
            const { gameId, playerId } = connectionResult.Item;

            // Don't kick players who disconnect while the game is still in the waiting lobby.
            // Mobile browsers drop WebSocket connections when switching apps — a transient
            // disconnect during lobby should not permanently remove the player. The client's
            // attemptReconnect will fire handleRejoinGame and restore their session.
            // Only kick immediately during active gameplay where a ghost player blocks progress.
            const gameResult = await dynamodb.send(new GetCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId }
            }));

            if (gameResult.Item?.meta?.status === 'waiting') {
                return { statusCode: 200 };
            }

            await handleKickPlayer(connectionId, gameId, playerId, playerId, 'disconnect');
        }
        
        return { statusCode: 200 };
    } catch (error) {
        console.error('Disconnect error:', error);
        return { statusCode: 500 };
    }
};
