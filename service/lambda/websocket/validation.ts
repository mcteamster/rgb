import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from './aws-clients';

export async function validatePlayerAction(connectionId: string, gameId: string, playerId: string): Promise<{ statusCode: number }> {
    // 1. Verify player belongs to game
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 }; // Game not found
    }
    
    const game = gameResult.Item;
    const player = game.players.find((p: any) => p.playerId === playerId);
    if (!player) {
        return { statusCode: 403 }; // Player not in game
    }
    
    // 2. Verify connection belongs to player
    const connectionResult = await dynamodb.send(new GetCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId }
    }));
    
    if (!connectionResult.Item || 
        connectionResult.Item.playerId !== playerId || 
        connectionResult.Item.gameId !== gameId) {
        return { statusCode: 403 }; // Connection mismatch
    }
    
    return { statusCode: 200 }; // Validation passed
}
