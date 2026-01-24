import { UpdateCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { HSLColor, Player } from './types';
import { dynamodb, broadcastToGame, sendToConnection } from './aws-clients';
import { getCurrentRound, findLastSubmittedColor, isValidHSLColor, generateRandomHSLColor, calculateColorScore, shouldEndGame } from './utils';

export async function handleUpdateDraftDescription(connectionId: string, gameId: string, playerId: string, description: string): Promise<APIGatewayProxyResultV2> {
    if (description.length > 100) {
        return { statusCode: 400 };
    }
    
    // Get current game state
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);
    
    if (!currentRound || currentRound.phase !== 'describing' || currentRound.describerId !== playerId) {
        return { statusCode: 400 };
    }
    
    // Update draft description in the player object
    const updatedPlayers = game.players.map((player: any) => 
        player.playerId === playerId 
            ? { ...player, draftDescription: description }
            : player
    );
    
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: 'SET players = :players',
        ExpressionAttributeValues: {
            ':players': updatedPlayers
        }
    }));
    
    return { statusCode: 200 };
}

export async function handleSubmitDescription(connectionId: string, gameId: string, playerId: string, description: string): Promise<APIGatewayProxyResultV2> {
    if (!description || description.length > 100) {
        return { statusCode: 400 };
    }
    
    // Get game to access config
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);
    
    if (!currentRound) {
        return { statusCode: 404 };
    }
    
    // State consistency check - verify still describer and in describing phase
    if (currentRound.describerId !== playerId || currentRound.phase !== 'describing') {
        return { statusCode: 409 }; // State changed
    }
    
    // Check if no clue was provided - skip to reveal with special scoring
    if (description === '<NO CLUE>') {
        // Give all other players +100 points, describer gets 0
        const roundScores: Record<string, number> = {};
        game.players.forEach((player: any) => {
            if (player.playerId === currentRound.describerId) {
                roundScores[player.playerId] = 0;
            } else {
                roundScores[player.playerId] = 100;
            }
        });

        // Update player total scores
        const updatedPlayers = game.players.map((player: any) => {
            let totalScore = 0;
            game.gameplay.rounds.forEach((round: any) => {
                if (round.scores && round.scores[player.playerId]) {
                    totalScore += round.scores[player.playerId];
                }
            });
            totalScore += roundScores[player.playerId];
            return {
                ...player,
                score: totalScore
            };
        });

        try {
            await dynamodb.send(new UpdateCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId },
                UpdateExpression: `SET gameplay.rounds[${game.meta.currentRound}].description = :description, gameplay.rounds[${game.meta.currentRound}].phase = :phase, gameplay.rounds[${game.meta.currentRound}].submissions = :submissions, gameplay.rounds[${game.meta.currentRound}].scores = :scores, players = :players`,
                ConditionExpression: `gameplay.rounds[${game.meta.currentRound}].describerId = :playerId AND gameplay.rounds[${game.meta.currentRound}].phase = :describingPhase`,
                ExpressionAttributeValues: {
                    ':description': null,
                    ':phase': 'reveal',
                    ':submissions': {},
                    ':scores': roundScores,
                    ':players': updatedPlayers,
                    ':playerId': playerId,
                    ':describingPhase': 'describing'
                }
            }));
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return { statusCode: 409 }; // State changed - no longer describer or wrong phase
            }
            throw error;
        }

        const updatedGame = await dynamodb.send(new GetCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId }
        }));

        // Broadcast meta and gameplay updates
        await broadcastToGame(gameId, {
            type: 'metaUpdated',
            meta: updatedGame.Item!.meta
        });

        await broadcastToGame(gameId, {
            type: 'gameplayUpdated',
            gameplay: updatedGame.Item!.gameplay
        });

        // Broadcast updated players with new scores
        await broadcastToGame(gameId, {
            type: 'playersUpdated',
            players: updatedGame.Item!.players
        });

        return { statusCode: 200 };
    }

    // Normal flow - proceed to guessing phase
    // Players keep their existing draft colors
    const updatedPlayers = game.players;

    // Update description with atomic state validation
    try {
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: `SET gameplay.rounds[${game.meta.currentRound}].description = :description, gameplay.rounds[${game.meta.currentRound}].phase = :phase, gameplay.rounds[${game.meta.currentRound}].timers.guessingDeadline = :deadline, players = :players`,
            ConditionExpression: `gameplay.rounds[${game.meta.currentRound}].describerId = :playerId AND gameplay.rounds[${game.meta.currentRound}].phase = :describingPhase`,
            ExpressionAttributeValues: {
                ':description': description,
                ':phase': 'guessing',
                ':deadline': new Date(Date.now() + game.config.guessingTimeLimit * 1000).toISOString(),
                ':players': updatedPlayers,
                ':playerId': playerId,
                ':describingPhase': 'describing'
            }
        }));
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return { statusCode: 409 }; // State changed - no longer describer or wrong phase
        }
        throw error;
    }
    
    const updatedGame = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    // Broadcast meta and gameplay updates
    await broadcastToGame(gameId, {
        type: 'metaUpdated',
        meta: updatedGame.Item!.meta
    });

    await broadcastToGame(gameId, {
        type: 'gameplayUpdated',
        gameplay: updatedGame.Item!.gameplay
    });
    
    return { statusCode: 200 };
}

export async function handleUpdateDraftColor(connectionId: string, gameId: string, playerId: string, color: HSLColor): Promise<APIGatewayProxyResultV2> {
    if (!isValidHSLColor(color)) {
        return { statusCode: 400 };
    }
    
    // Get current game state
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    
    // Find the player index for atomic update
    const playerIndex = game.players.findIndex((p: any) => p.playerId === playerId);
    if (playerIndex === -1) {
        return { statusCode: 404 };
    }
    
    // Atomically update only this player's draft color
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: `SET players[${playerIndex}].draftColor = :color`,
        ExpressionAttributeValues: {
            ':color': color
        }
    }));

    // Get updated game state for broadcasting
    const updatedGameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    // Broadcast updated players to all connected clients
    await broadcastToGame(gameId, {
        type: 'playersUpdated',
        players: updatedGameResult.Item?.players
    });
    
    return { statusCode: 200 };
}

export async function handleSubmitColor(connectionId: string, gameId: string, playerId: string, color: HSLColor): Promise<APIGatewayProxyResultV2> {
    if (!isValidHSLColor(color)) {
        return { statusCode: 400 };
    }
    
    // Get current game state first
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    const players = game.players || [];
    const currentRound = getCurrentRound(game);
    
    if (!currentRound || currentRound.phase !== 'guessing') {
        return { statusCode: 400 };
    }
    
    // State consistency check - prevent duplicate submission
    if (currentRound.submissions && currentRound.submissions[playerId]) {
        return { statusCode: 409 }; // Already submitted
    }
    
    // Update round submissions with conditional check to prevent duplicates
    try {
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: `SET gameplay.rounds[${game.meta.currentRound}].submissions.#playerId = :color`,
            ConditionExpression: `attribute_not_exists(gameplay.rounds[${game.meta.currentRound}].submissions.#playerId)`,
            ExpressionAttributeNames: { 
                '#playerId': playerId
            },
            ExpressionAttributeValues: {
                ':color': color
            }
        }));
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return { statusCode: 409 }; // Already submitted
        }
        throw error;
    }
    
    // Get updated game state
    const updatedGame = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    // Broadcast meta update
    await broadcastToGame(gameId, {
        type: 'metaUpdated',
        meta: updatedGame.Item!.meta
    });
    
    const updatedCurrentRound = getCurrentRound(updatedGame.Item!);
    const updatedSubmissions = updatedCurrentRound?.submissions || {};
    const expectedGuessers = players.filter((p: any) => p.playerId !== currentRound.describerId).length;
    const actualGuesses = Object.keys(updatedSubmissions).length;
    
    console.log('Submissions check:', { expectedGuessers, actualGuesses });
    
    // If all guesses are in, progress to reveal phase
    if (actualGuesses >= expectedGuessers) {
        // Calculate scores for this round
        const targetColor = currentRound.targetColor;
        const roundScores: Record<string, number> = {};
        
        // Calculate scores for each guesser
        const guesserScores: number[] = [];
        Object.entries(updatedSubmissions).forEach(([playerId, guessedColor]: [string, any]) => {
            const score = calculateColorScore(targetColor, guessedColor);
            roundScores[playerId] = score;
            guesserScores.push(score);
        });
        
        // Calculate describer score (average of all guesser scores)
        if (guesserScores.length > 0) {
            const averageScore = Math.round(guesserScores.reduce((sum, score) => sum + score, 0) / guesserScores.length);
            roundScores[currentRound.describerId] = averageScore;
        }
        
        const finalRounds = [...updatedGame.Item!.gameplay.rounds];
        finalRounds[updatedGame.Item!.meta.currentRound] = {
            ...updatedCurrentRound,
            phase: 'reveal',
            scores: roundScores
        };
        
        // Update player total scores
        const updatedPlayers = updatedGame.Item!.players.map((player: any) => {
            let totalScore = 0;
            finalRounds.forEach(round => {
                if (round.scores && round.scores[player.playerId]) {
                    totalScore += round.scores[player.playerId];
                }
            });
            return {
                ...player,
                score: totalScore
            };
        });

        // Don't automatically transition to endgame - let client decide
        // Check if game should end is available for client to query
        // const shouldEnd = shouldEndGame(gameWithUpdatedRounds);

        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: 'SET gameplay.rounds = :rounds, players = :players',
            ExpressionAttributeValues: {
                ':rounds': finalRounds,
                ':players': updatedPlayers
            }
        }));
        
        // Get final updated state
        const finalGame = await dynamodb.send(new GetCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId }
        }));
        
        // Broadcast meta update
        await broadcastToGame(gameId, {
            type: 'metaUpdated',
            meta: finalGame.Item!.meta
        });

        // Also broadcast gameplay update for reveal phase
        await broadcastToGame(gameId, {
            type: 'gameplayUpdated',
            gameplay: finalGame.Item!.gameplay
        });

        // Broadcast updated players with new scores
        await broadcastToGame(gameId, {
            type: 'playersUpdated',
            players: finalGame.Item!.players
        });
    } else {
        await broadcastToGame(gameId, {
            type: 'gameplayUpdated',
            gameplay: updatedGame.Item!.gameplay
        });
    }
    
    return { statusCode: 200 };
}

export async function handleStartRound(connectionId: string, gameId: string, playerId: string): Promise<APIGatewayProxyResultV2> {
    console.log('Starting round for game:', gameId);
    
    // Get current game state to select describer
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) {
        console.log('Game not found:', gameId);
        return { statusCode: 404 };
    }
    
    const game = gameResult.Item;
    const players = game.players || [];
    
    // Find the host (player who joined earliest)
    const hostPlayer = players.reduce((earliest: any, player: any) => 
        new Date(player.joinedAt) < new Date(earliest.joinedAt) ? player : earliest
    );
    
    // Only allow host to start the game when in waiting status
    if (game.meta.status === 'waiting' && playerId !== hostPlayer.playerId) {
        await sendToConnection(connectionId, {
            type: 'error',
            error: 'Only the host can start the game'
        });
        return { statusCode: 403 };
    }
    
    console.log('Game found with players:', players.length);
    
    if (players.length < 2) {
        console.log('Not enough players:', players.length);
        return { statusCode: 400 };
    }
    
    // State consistency check - verify game can start a new round
    const currentRound = getCurrentRound(game);
    const canStartRound = game.meta.status === 'waiting' || 
                         (game.meta.status === 'playing' && currentRound?.phase === 'reveal');
    
    if (!canStartRound) {
        return { statusCode: 409 }; // Cannot start round in current state
    }
    
    // Select describer based on turn history
    const rounds = game.gameplay?.rounds || [];
    const playerClueCount = players.map((player: Player) => {
        const cluesGiven = rounds.filter((round: any) => round.describerId === player.playerId).length;
        const lastClueRound = rounds.findLastIndex((round: any) => round.describerId === player.playerId);
        return { playerId: player.playerId, cluesGiven, lastClueRound };
    });
    
    // Find the minimum number of clues given
    const minClues = Math.min(...playerClueCount.map((p: any) => p.cluesGiven));
    
    // Get all players who have given the minimum number of clues
    let eligiblePlayers = playerClueCount.filter((p: any) => p.cluesGiven === minClues);
    
    // Avoid back-to-back selection if possible
    const lastRound = (game.gameplay?.rounds || []).slice(-1)[0];
    if (lastRound) {
        const nonRepeatPlayers = eligiblePlayers.filter((p: any) => p.playerId !== lastRound.describerId);
        if (nonRepeatPlayers.length > 0) {
            eligiblePlayers = nonRepeatPlayers;
        }
    }
    
    // Selection logic: random for first round, then longest ago
    let selectedPlayer;
    if (minClues === 0) {
        // First round for these players - random selection
        selectedPlayer = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
    } else {
        // Subsequent rounds - select who gave clue longest ago
        selectedPlayer = eligiblePlayers.sort((a: any, b: any) => a.lastClueRound - b.lastClueRound)[0];
    }
    const describerId = selectedPlayer.playerId;
    const targetColor = generateRandomHSLColor();
    
    console.log('Selected describer:', describerId, 'Target color:', targetColor);
    
    // Add new round atomically with state validation
    const newRound = {
        targetColor,
        startedAt: new Date().toISOString(),
        describerId,
        phase: 'describing',
        submissions: {},
        timers: {
            descriptionDeadline: new Date(Date.now() + game.config.descriptionTimeLimit * 1000).toISOString(),
            guessingDeadline: null // Will be set when transitioning to guessing phase
        }
    };
    
    const currentRounds = game.gameplay.rounds || [];
    const newRoundIndex = currentRounds.length;
    const updatedRounds = [...currentRounds, newRound];
    
    try {
        const conditionExpression = game.meta.status === 'waiting' ? 
            'meta.#status = :waitingStatus' : 
            'meta.#status = :playingStatus AND gameplay.rounds[' + game.meta.currentRound + '].phase = :revealPhase';
            
        const expressionAttributeValues: any = {
            ':currentRoundIndex': newRoundIndex,
            ':status': 'playing',
            ':rounds': updatedRounds
        };
        
        if (game.meta.status === 'waiting') {
            expressionAttributeValues[':waitingStatus'] = 'waiting';
        } else {
            expressionAttributeValues[':playingStatus'] = 'playing';
            expressionAttributeValues[':revealPhase'] = 'reveal';
        }
        
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: 'SET meta.currentRound = :currentRoundIndex, meta.#status = :status, gameplay.rounds = :rounds',
            ConditionExpression: conditionExpression,
            ExpressionAttributeNames: { 
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ...expressionAttributeValues
            }
        }));
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return { statusCode: 409 }; // Cannot start round in current state
        }
        throw error;
    }
    
    const updatedGame = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    console.log('Broadcasting game state update to game:', gameId);
    
    // Broadcast meta and gameplay updates
    await broadcastToGame(gameId, {
        type: 'metaUpdated',
        meta: updatedGame.Item!.meta
    });

    await broadcastToGame(gameId, {
        type: 'gameplayUpdated',
        gameplay: updatedGame.Item!.gameplay
    });
    
    return { statusCode: 200 };
}
export async function handleFinaliseGame(connectionId: string, gameId: string, playerId: string): Promise<APIGatewayProxyResultV2> {
    // Get current game state
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    if (!gameResult.Item) {
        return { statusCode: 404 };
    }

    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);

    if (!currentRound || currentRound.phase !== 'reveal') {
        return { statusCode: 400 }; // Can only end game from reveal phase
    }

    // Check if game should end
    const shouldEnd = shouldEndGame(game);
    if (!shouldEnd) {
        return { statusCode: 400 }; // Not ready for endgame
    }

    // Update current round to endgame phase
    const updatedRounds = [...game.gameplay.rounds];
    updatedRounds[game.meta.currentRound] = {
        ...currentRound,
        phase: 'endgame'
    };

    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: 'SET gameplay.rounds = :rounds',
        ExpressionAttributeValues: {
            ':rounds': updatedRounds
        }
    }));

    // Get updated game state
    const updatedGame = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    // Broadcast gameplay update
    await broadcastToGame(gameId, {
        type: 'gameplayUpdated',
        gameplay: updatedGame.Item!.gameplay
    });

    return { statusCode: 200 };
}

export async function handleResetGame(connectionId: string, gameId: string, playerId: string): Promise<APIGatewayProxyResultV2> {
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

    // Only allow host to reset the game
    if (playerId !== hostPlayer.playerId) {
        return { statusCode: 403 }; // Forbidden
    }

    // Reset game to waiting state (allow reset from any phase)
    await dynamodb.send(new UpdateCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId },
        UpdateExpression: 'SET meta.#status = :status, meta.currentRound = :currentRound, gameplay.rounds = :rounds',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'waiting',
            ':currentRound': -1,
            ':rounds': []
        }
    }));

    // Get updated game state
    const updatedGame = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    // Broadcast full game state update
    await broadcastToGame(gameId, {
        type: 'gameStateUpdated',
        gameState: updatedGame.Item
    });

    return { statusCode: 200 };
}

export async function handleCloseRoom(connectionId: string, gameId: string, playerId: string): Promise<APIGatewayProxyResultV2> {
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

    // Only allow host to close the room
    if (playerId !== hostPlayer.playerId) {
        return { statusCode: 403 }; // Forbidden
    }

    // Broadcast room closure to all players
    await broadcastToGame(gameId, {
        type: 'kicked',
        message: 'The room has been closed by the host'
    });

    // Delete the game from the database
    await dynamodb.send(new DeleteCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));

    return { statusCode: 200 };
}
