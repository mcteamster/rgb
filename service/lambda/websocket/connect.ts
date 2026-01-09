import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
    const connectionId = event.requestContext.connectionId;
    const now = new Date();
    const ttl = Math.floor((now.getTime() + 12 * 60 * 60 * 1000) / 1000); // 12 hours from now in seconds
    
    try {
        await dynamodb.send(new PutCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Item: {
                connectionId,
                connectedAt: now.toISOString(),
                ttl
            }
        }));
        
        return { statusCode: 200 };
    } catch (error) {
        return { statusCode: 500 };
    }
};
