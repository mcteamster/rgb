import { UpdateCommand, GetCommand, DeleteCommand, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { dynamodb, sendToConnection, broadcastToGame } from './aws-clients';
import { generateGameId, generatePlayerId } from './utils';
import { checkAndEnforceDeadlines } from './deadlines';

export async function handleCreateGame(connectionId: string, playerName: string, config?: { maxPlayers?: number; descriptionTimeLimit?: number; guessingTimeLimit?: number; turnsPerPlayer?: number }): Promise<APIGatewayProxyResultV2> {
    if (!playerName || playerName.length > 16) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Player name must be 1-16 characters'
        });
        return { statusCode: 400 };
    }

    // Validate and set config with defaults
    const gameConfig = {
        maxPlayers: Math.min(Math.max(config?.maxPlayers || 10, 2), 10), // 2-10 players
        descriptionTimeLimit: Math.min(Math.max(config?.descriptionTimeLimit || 30, 10), 86400), // 10 seconds to 24 hours
        guessingTimeLimit: Math.min(Math.max(config?.guessingTimeLimit || 15, 5), 86400), // 5 seconds to 24 hours
        turnsPerPlayer: Math.min(Math.max(config?.turnsPerPlayer || 2, 1), 5) // 1-5 turns per player
    };
    
    console.log('Creating game with config:', gameConfig);

    const gameId = generateGameId();
    const playerId = generatePlayerId();
    const createTime = new Date();
    const gameTtl = Math.floor((createTime.getTime() + 12 * 60 * 60 * 1000) / 1000); // 12 hours from now in seconds
    
    const gameItem = {
        gameId,
        config: gameConfig,
        meta: {
            status: 'waiting',
            currentRound: null,
            createdAt: createTime.toISOString()
        },
        players: [{ playerId, playerName, joinedAt: createTime.toISOString(), draftColor: { h: 0, s: 0, l: 0 } }],
        gameplay: {
            rounds: []
        },
        ttl: gameTtl
    };
    
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: 'SET config = :config, meta = :meta, players = :players, gameplay = :gameplay, #ttl = :ttl',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
            ':config': gameItem.config,
            ':meta': gameItem.meta,
            ':players': gameItem.players,
            ':gameplay': gameItem.gameplay,
            ':ttl': gameItem.ttl
        }
    }));

    // Associate this WebSocket connection with the game and player
    const connectTime = new Date();
    const connectTtl = Math.floor((connectTime.getTime() + 12 * 60 * 60 * 1000) / 1000); // 12 hours from now in seconds
    
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId },
        UpdateExpression: 'SET gameId = :gameId, playerId = :playerId, #ttl = :ttl',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
            ':gameId': gameId,
            ':playerId': playerId,
            ':ttl': connectTtl
        }
    }));
    
    await sendToConnection(connectionId, {
        type: 'gameStateUpdated',
        gameState: gameItem,
        playerId: playerId
    });
    
    return { statusCode: 200 };
}

export async function handleGetGame(connectionId: string, gameId: string): Promise<APIGatewayProxyResultV2> {
    // Check and enforce deadlines before getting game state
    await checkAndEnforceDeadlines(gameId);
    
    const result = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!result.Item) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Game not found'
        });
        return { statusCode: 404 };
    }
    
    await sendToConnection(connectionId, {
        type: 'gameStateUpdated',
        gameState: result.Item
    });
    
    return { statusCode: 200 };
}

export async function handleJoinGame(connectionId: string, gameId: string, playerName: string): Promise<APIGatewayProxyResultV2> {
    if (!playerName || playerName.length > 16) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Player name must be 1-16 characters'
        });
        return { statusCode: 400 };
    }
    
    const result = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!result.Item) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Game not found'
        });
        return { statusCode: 404 };
    }
    
    const game = result.Item;
    
    // Check if player name matches an existing player
    const existingPlayer = game.players.find((player: any) => player.playerName === playerName);
    
    if (existingPlayer) {
        // For games in progress, allow reconnection only if player is not currently connected
        if (game.meta.status !== 'waiting') {
            // Check if this player is currently connected using GSI
            const existingConnection = await dynamodb.send(new QueryCommand({
                TableName: process.env.CONNECTIONS_TABLE!,
                IndexName: 'GameIdIndex',
                KeyConditionExpression: 'gameId = :gameId',
                FilterExpression: 'playerId = :playerId',
                ExpressionAttributeValues: {
                    ':gameId': gameId,
                    ':playerId': existingPlayer.playerId
                }
            }));

            if (existingConnection.Items && existingConnection.Items.length > 0) {
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Player is already connected'
                });
                return { statusCode: 400 };
            }

            const playerId = existingPlayer.playerId;
            
            // Update connection table to associate this WebSocket with the game
            const joinTime = new Date();
            try {
                await dynamodb.send(new PutCommand({
                    TableName: process.env.CONNECTIONS_TABLE!,
                    Item: {
                        connectionId,
                        gameId,
                        playerId,
                        joinedAt: joinTime.toISOString()
                    }
                }));
            } catch (error) {
                console.error('Error updating connection table in reconnection:', error);
                throw error;
            }

            // Send game state to reconnecting player
            await sendToConnection(connectionId, {
                type: 'gameStateUpdated',
                gameState: game,
                playerId
            });

            // Broadcast player reconnection
            await broadcastToGame(gameId, {
                type: 'playersUpdated',
                players: game.players
            });

            return { statusCode: 200 };
        } else {
            // For waiting games, don't allow duplicate names
            await sendToConnection(connectionId, {
                type: 'error',
                error: 'Player name is already taken'
            });
            return { statusCode: 400 };
        }
    }
    
    // Only allow joining new games in waiting status
    if (game.meta.status !== 'waiting') {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Game is already in progress'
        });
        return { statusCode: 400 };
    }
    
    if (game.players.length >= game.config.maxPlayers) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Game is full'
        });
        return { statusCode: 400 };
    }
    
    const playerId = generatePlayerId();
    game.players.push({ playerId, playerName, joinedAt: new Date().toISOString(), draftColor: { h: 0, s: 0, l: 0 } });
    
    // Update the game state first
    try {
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: 'SET players = :players',
            ExpressionAttributeValues: {
                ':players': game.players
            }
        }));
    } catch (error) {
        console.error('Error updating game state in joinGame:', error);
        throw error;
    }

    // Then update the connection table to associate this WebSocket with the game
    const joinTime = new Date();
    const joinTtl = Math.floor((joinTime.getTime() + 12 * 60 * 60 * 1000) / 1000); // 12 hours from now in seconds
    
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId },
        UpdateExpression: 'SET gameId = :gameId, playerId = :playerId, #ttl = :ttl',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
            ':gameId': gameId,
            ':playerId': playerId,
            ':ttl': joinTtl
        }
    }));
    
    console.log('Connection updated for:', connectionId, 'with gameId:', gameId, 'playerId:', playerId);
    
    // Send full game state to the joining player
    await sendToConnection(connectionId, {
        type: 'gameStateUpdated',
        gameState: game,
        playerId: playerId
    });
    
    console.log('About to broadcast playersUpdated for game:', gameId, 'with players:', game.players);
    
    // Small delay to ensure GSI is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Broadcast player list update to all OTHER players (exclude the one who just joined)
    const connections = await dynamodb.send(new QueryCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        IndexName: 'GameIdIndex',
        KeyConditionExpression: 'gameId = :gameId',
        ExpressionAttributeValues: { ':gameId': gameId }
    }));
    
    const otherConnections = connections.Items?.filter(conn => conn.connectionId !== connectionId) || [];
    
    const promises = otherConnections.map(async (connection) => {
        try {
            await sendToConnection(connection.connectionId, {
                type: 'playersUpdated',
                players: game.players
            });
        } catch (error: any) {
            console.error('Error sending to connection:', connection.connectionId, error);
        }
    });
    
    await Promise.all(promises);
    
    return { statusCode: 200 };
}

export async function handleRejoinGame(connectionId: string, gameId: string, playerId: string): Promise<APIGatewayProxyResultV2> {
    // Get current game state
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Game not found'
        });
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    
    // Check if player is still in the game
    const playerExists = game.players.some((p: any) => p.playerId === playerId);
    if (!playerExists) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Player not found in game'
        });
        return { statusCode: 404 };
    }
    
    // Update the connection table to associate this WebSocket with the game and player
    const rejoinTime = new Date();
    const rejoinTtl = Math.floor((rejoinTime.getTime() + 12 * 60 * 60 * 1000) / 1000); // 12 hours from now in seconds
    
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        Key: { connectionId },
        UpdateExpression: 'SET gameId = :gameId, playerId = :playerId, #ttl = :ttl',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
            ':gameId': gameId,
            ':playerId': playerId,
            ':ttl': rejoinTtl
        }
    }));
    
    // Send full game state with player ID
    await sendToConnection(connectionId, {
        type: 'gameStateUpdated',
        gameState: game,
        playerId: playerId
    });
    
    return { statusCode: 200 };
}

export async function handleKickPlayer(
    initiatorConnectionId: string, 
    gameId: string, 
    initiatorPlayerId: string,
    targetPlayerId: string, 
    reason: 'leave' | 'kick' | 'disconnect' = 'leave'
): Promise<APIGatewayProxyResultV2> {
    // Get current game state
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    
    // Find the host (player who joined earliest)
    const hostPlayer = game.players.reduce((earliest: any, player: any) => 
        new Date(player.joinedAt) < new Date(earliest.joinedAt) ? player : earliest
    );
    
    // Only allow host to kick others (or anyone to leave themselves)
    if (reason === 'kick' && initiatorPlayerId !== hostPlayer.playerId) {
        await sendToConnection(initiatorConnectionId, {
            type: 'error',
            error: 'Only the host can kick players'
        });
        return { statusCode: 403 };
    }
    
    const targetPlayer = game.players.find((p: any) => p.playerId === targetPlayerId);
    
    if (!targetPlayer) {
        return { statusCode: 404 };
    }
    
    const updatedPlayers = game.players.filter((p: any) => p.playerId !== targetPlayerId);
    
    // Update game state to remove player
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: 'SET players = :players',
        ExpressionAttributeValues: {
            ':players': updatedPlayers
        }
    }));
    
    // Find target player's connection to clear association
    const connectionsResult = await dynamodb.send(new QueryCommand({
        TableName: process.env.CONNECTIONS_TABLE!,
        IndexName: 'GameIdIndex',
        KeyConditionExpression: 'gameId = :gameId',
        FilterExpression: 'playerId = :playerId',
        ExpressionAttributeValues: {
            ':gameId': gameId,
            ':playerId': targetPlayerId
        }
    }));
    
    // Notify target player they were kicked/left and clear game association
    if (connectionsResult.Items && connectionsResult.Items.length > 0) {
        const targetConnectionId = connectionsResult.Items[0].connectionId;
        
        // Send notification to kicked player
        if (reason === 'kick') {
            await sendToConnection(targetConnectionId, {
                type: 'kicked',
                message: 'You have been removed from the game by the host'
            });
        }
        
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Key: { connectionId: targetConnectionId },
            UpdateExpression: 'REMOVE gameId, playerId'
        }));
    }
    
    // Broadcast updated player list to remaining players
    await broadcastToGame(gameId, {
        type: 'playersUpdated',
        players: updatedPlayers
    });
    
    return { statusCode: 200 };
}
