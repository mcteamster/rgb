import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const client = new DynamoDBClient({});
export const dynamodb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

export const apigateway = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT
});

export async function broadcastToGame(gameId: string, message: any): Promise<void> {
    console.log('Broadcasting to game:', gameId, 'Message type:', message.type);
    
    const connections = await dynamodb.send(new QueryCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        IndexName: 'GameIdIndex',
        KeyConditionExpression: 'gameId = :gameId',
        ExpressionAttributeValues: { ':gameId': gameId }
    }));
    
    console.log('Found connections for game:', gameId, 'Count:', connections.Items?.length || 0);
    
    const promises = connections.Items!.map(async (connection) => {
        try {
            console.log('Sending message to connection:', connection.connectionId);
            await apigateway.send(new PostToConnectionCommand({
                ConnectionId: connection.connectionId,
                Data: JSON.stringify(message)
            }));
        } catch (error: any) {
            console.error('Error sending to connection:', connection.connectionId, error);
            if (error.statusCode === 410) {
                await dynamodb.send(new DeleteCommand({
                    TableName: process.env.CONNECTIONS_TABLE!,
                    Key: { connectionId: connection.connectionId }
                }));
            }
        }
    });
    
    await Promise.all(promises);
}

export async function sendToConnection(connectionId: string, message: any): Promise<void> {
    try {
        await apigateway.send(new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(message)
        }));
    } catch (error: any) {
        if (error.statusCode === 410) {
            await dynamodb.send(new DeleteCommand({
                TableName: process.env.CONNECTIONS_TABLE!,
                Key: { connectionId }
            }));
        }
    }
}
