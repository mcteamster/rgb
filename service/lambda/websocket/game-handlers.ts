import { UpdateCommand, GetCommand, DeleteCommand, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { dynamodb, sendToConnection, broadcastToGame } from './aws-clients';
import { generateGameId, generatePlayerId, getCurrentRound, sanitiseGameStateForClient, isHost, resolveHostPlayerId } from './utils';
import { checkAndEnforceDeadlines } from './deadlines';
import { resolveRoundScores } from './round-handlers';
import { Player } from './types';

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
            createdAt: createTime.toISOString(),
            hostPlayerId: playerId
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
        gameState: sanitiseGameStateForClient(gameItem),
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
        gameState: sanitiseGameStateForClient(result.Item)
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
    const existingPlayer = game.players.find((player: Player) => player.playerName === playerName);
    
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
                gameState: sanitiseGameStateForClient(game),
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
    const newPlayer: Player = { playerId, playerName, joinedAt: new Date().toISOString(), draftColor: { h: 0, s: 0, l: 0 } };

    // Guarded write: append with list_append and a ConditionExpression that
    // enforces the observed player count, capacity, and status at write time.
    // On ConditionalCheckFailedException, re-read with a strongly-consistent
    // GetCommand and re-run the duplicate-name / status / capacity checks
    // before retrying. Cap retries to avoid unbounded contention.
    const MAX_JOIN_ATTEMPTS = 5;
    let expectedCount = game.players.length;
    let currentGame = game;

    for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt++) {
        try {
            await dynamodb.send(new UpdateCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId },
                UpdateExpression: 'SET players = list_append(players, :newPlayer)',
                ConditionExpression:
                    'size(players) = :expectedCount AND size(players) < :maxPlayers AND meta.#status = :waiting',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':newPlayer': [newPlayer],
                    ':expectedCount': expectedCount,
                    ':maxPlayers': currentGame.config.maxPlayers,
                    ':waiting': 'waiting'
                }
            }));
            // Write succeeded — build the updated players list for subsequent messaging.
            currentGame = { ...currentGame, players: [...currentGame.players, newPlayer] };
            break;
        } catch (error: any) {
            if (error.name !== 'ConditionalCheckFailedException') {
                console.error('Error updating game state in joinGame:', error);
                throw error;
            }

            // Concurrent modification — re-read with strong consistency.
            const freshResult = await dynamodb.send(new GetCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId },
                ConsistentRead: true
            }));

            if (!freshResult.Item) {
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Game not found'
                });
                return { statusCode: 404 };
            }

            currentGame = freshResult.Item as typeof game;

            // Re-run guards against fresh state.
            const freshDuplicate = currentGame.players.find((p: Player) => p.playerName === playerName);
            if (freshDuplicate) {
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Player name is already taken'
                });
                return { statusCode: 400 };
            }

            if (currentGame.meta.status !== 'waiting') {
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Game is already in progress'
                });
                return { statusCode: 400 };
            }

            if (currentGame.players.length >= currentGame.config.maxPlayers) {
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Game is full'
                });
                return { statusCode: 400 };
            }

            // State still allows the join — update expected count and retry.
            expectedCount = currentGame.players.length;

            if (attempt === MAX_JOIN_ATTEMPTS - 1) {
                console.error('joinGame exhausted retries for gameId:', gameId);
                await sendToConnection(connectionId, {
                    type: 'error',
                    error: 'Failed to join game due to concurrent activity; please try again'
                });
                return { statusCode: 409 };
            }
        }
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
        gameState: sanitiseGameStateForClient(currentGame),
        playerId: playerId
    });
    
    console.log('About to broadcast playersUpdated for game:', gameId, 'with players:', currentGame.players);
    
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
                players: currentGame.players
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
        gameState: sanitiseGameStateForClient(game),
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

    // Build the persistFn for resolveHostPlayerId read-repair
    const persistHostId = async (gId: string, hostPlayerId: string) => {
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId: gId },
            UpdateExpression: 'SET meta.hostPlayerId = :hostPlayerId',
            ExpressionAttributeValues: { ':hostPlayerId': hostPlayerId }
        }));
        // Patch the in-memory game object so subsequent isHost calls use the resolved value
        game.meta.hostPlayerId = hostPlayerId;
    };

    // Resolve and (if needed) read-repair the authoritative host ID
    const resolvedHostId = await resolveHostPlayerId(game, persistHostId);
    // Ensure in-memory meta reflects the resolved value for isHost()
    if (!game.meta.hostPlayerId) {
        game.meta.hostPlayerId = resolvedHostId;
    }

    // Only allow host to kick others (or anyone to leave themselves, or internal disconnect)
    if (reason === 'kick' && !isHost(game, initiatorPlayerId)) {
        await sendToConnection(initiatorConnectionId, {
            type: 'error',
            error: 'Only the host can kick players'
        });
        return { statusCode: 403 };
    }
    
    const targetPlayer = game.players.find((p: Player) => p.playerId === targetPlayerId);
    
    if (!targetPlayer) {
        return { statusCode: 404 };
    }
    
    const updatedPlayers = game.players.filter((p: Player) => p.playerId !== targetPlayerId);

    // Determine new host if the host is being removed and there are remaining players
    const hostIsLeaving = targetPlayerId === resolvedHostId;
    let newHostId: string | null = null;
    if (hostIsLeaving && updatedPlayers.length >= 1) {
        // Promote earliest-joinedAt remaining player; tie-break by playerId lex order
        const sorted = [...updatedPlayers].sort((a: Player, b: Player) => {
            const timeDiff = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.playerId < b.playerId ? -1 : 1;
        });
        newHostId = sorted[0].playerId;
    }

    // Helper: clear target connection and optionally notify
    const cleanupTargetConnection = async () => {
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

        if (connectionsResult.Items && connectionsResult.Items.length > 0) {
            const targetConnectionId = connectionsResult.Items[0].connectionId;
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
    };

    // Check current round phase to apply phase-specific logic
    const currentRound = getCurrentRound(game);

    // --- Below-minimum player guard ---
    // Must come before phase-specific logic
    if (game.meta.status === 'playing' && updatedPlayers.length < 2) {
        const belowMinExprValues: any = {
            ':players': updatedPlayers,
            ':status': 'waiting',
            ':nullRound': null
        };
        let belowMinUpdateExpr = 'SET players = :players, meta.#status = :status, meta.currentRound = :nullRound';
        if (newHostId) {
            belowMinUpdateExpr += ', meta.hostPlayerId = :newHostId';
            belowMinExprValues[':newHostId'] = newHostId;
        }

        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: belowMinUpdateExpr,
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: belowMinExprValues
        }));

        await cleanupTargetConnection();

        const updatedGame = await dynamodb.send(new GetCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId }
        }));

        await broadcastToGame(gameId, {
            type: 'gameStateUpdated',
            gameState: updatedGame.Item
        });

        return { statusCode: 200 };
    }

    // --- Describing-phase: describer was kicked ---
    if (currentRound && currentRound.describerId === targetPlayerId && currentRound.phase === 'describing') {
        // Nullify current round - all remaining players get 100 points
        const roundScores: Record<string, number> = {};
        updatedPlayers.forEach((player: Player) => {
            roundScores[player.playerId] = 100;
        });

        const updatedRounds = [...game.gameplay.rounds];
        updatedRounds[game.meta.currentRound] = {
            ...currentRound,
            description: null,
            phase: 'reveal',
            submissions: {},
            scores: roundScores
        };

        const playersWithScores = updatedPlayers.map((player: Player) => {
            let totalScore = 0;
            updatedRounds.forEach(round => {
                if (round.scores && round.scores[player.playerId]) {
                    totalScore += round.scores[player.playerId];
                }
            });
            return { ...player, score: totalScore };
        });

        const descExprValues: any = {
            ':players': playersWithScores,
            ':rounds': updatedRounds
        };
        let descUpdateExpr = 'SET players = :players, gameplay.rounds = :rounds';
        if (newHostId) {
            descUpdateExpr += ', meta.hostPlayerId = :newHostId';
            descExprValues[':newHostId'] = newHostId;
        }

        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: descUpdateExpr,
            ExpressionAttributeValues: descExprValues
        }));

        await cleanupTargetConnection();

        await broadcastToGame(gameId, {
            type: 'playersUpdated',
            players: updatedPlayers,
            ...(newHostId ? { hostPlayerId: newHostId } : {})
        });

        return { statusCode: 200 };
    }

    // --- Guessing-phase: a guesser was removed ---
    if (currentRound && currentRound.phase === 'guessing') {
        // Remaining guessers are all players except the describer (from updatedPlayers)
        const remainingGuessers = updatedPlayers.filter(
            (p: Player) => p.playerId !== currentRound.describerId
        );
        const allRemainingSubmitted = remainingGuessers.length > 0 &&
            remainingGuessers.every((p: Player) => currentRound.submissions?.[p.playerId]);

        const guessExprValues: any = { ':players': updatedPlayers };
        let guessUpdateExpr = 'SET players = :players';
        if (newHostId) {
            guessUpdateExpr += ', meta.hostPlayerId = :newHostId';
            guessExprValues[':newHostId'] = newHostId;
        }

        // Persist updated player list first
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: guessUpdateExpr,
            ExpressionAttributeValues: guessExprValues
        }));

        await cleanupTargetConnection();

        if (allRemainingSubmitted) {
            // All remaining guessers have submitted — resolve scores
            const updatedGame = await dynamodb.send(new GetCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId }
            }));
            await resolveRoundScores(gameId, updatedGame.Item!, updatedGame.Item!.meta.currentRound);
        } else {
            // Still waiting on guesses — just broadcast player update
            await broadcastToGame(gameId, {
                type: 'playersUpdated',
                players: updatedPlayers,
                ...(newHostId ? { hostPlayerId: newHostId } : {})
            });
        }

        return { statusCode: 200 };
    }

    // --- Default: waiting or reveal phase — remove player, broadcast ---
    const defExprValues: any = { ':players': updatedPlayers };
    let defUpdateExpr = 'SET players = :players';
    if (newHostId) {
        defUpdateExpr += ', meta.hostPlayerId = :newHostId';
        defExprValues[':newHostId'] = newHostId;
    }

    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: defUpdateExpr,
        ExpressionAttributeValues: defExprValues
    }));

    await cleanupTargetConnection();

    // Broadcast updated player list to remaining players
    await broadcastToGame(gameId, {
        type: 'playersUpdated',
        players: updatedPlayers,
        ...(newHostId ? { hostPlayerId: newHostId } : {})
    });
    
    return { statusCode: 200 };
}
