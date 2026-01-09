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
        
        // If connection was associated with a game, clean up the game state
        if (connectionResult.Item?.gameId && connectionResult.Item?.playerId) {
            const { gameId, playerId } = connectionResult.Item;
            
            // Use generic kick player function with disconnect reason
            await handleKickPlayer(connectionId, gameId, playerId, playerId, 'disconnect');
        }
        
        return { statusCode: 200 };
    } catch (error) {
        console.error('Disconnect error:', error);
        return { statusCode: 500 };
    }
};
