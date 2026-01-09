import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { dynamodb, broadcastToGame } from './aws-clients';
import { getCurrentRound, findLastSubmittedColor, calculateColorScore, shouldEndGame } from './utils';

export async function checkAndEnforceDeadlines(gameId: string): Promise<void> {
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) return;
    
    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);
    
    if (!currentRound) return;
    
    console.log('Checking deadlines for game:', gameId, 'phase:', currentRound.phase, 'descriptionDeadline:', currentRound.timers?.descriptionDeadline, 'guessingDeadline:', currentRound.timers?.guessingDeadline);
    
    const now = new Date();
    
    // Check description deadline
    if (currentRound.phase === 'describing' && 
        currentRound.timers?.descriptionDeadline && 
        new Date(currentRound.timers.descriptionDeadline) < now) {
        console.log('Enforcing description deadline for game:', gameId);
        await enforceDescriptionDeadline(gameId);
        return; // Re-check after enforcement
    }
    
    // Check guessing deadline
    if (currentRound.phase === 'guessing' && 
        currentRound.timers?.guessingDeadline && 
        new Date(currentRound.timers.guessingDeadline) < now) {
        console.log('Enforcing guessing deadline for game:', gameId);
        await enforceGuessingDeadline(gameId);
    }
}

async function enforceDescriptionDeadline(gameId: string): Promise<void> {
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) return;
    
    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);
    
    // Only enforce if still in describing phase
    if (currentRound?.phase === 'describing') {
        // Get draft description from the describer player
        const describer = game.players.find((p: any) => p.playerId === currentRound.describerId);
        const draftDescription = describer?.draftDescription || '';
        
        // Check if no clue was provided (blank draft) - skip to reveal with special scoring
        if (!draftDescription.trim()) {
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

            const updatedRounds = [...game.gameplay.rounds];
            updatedRounds[game.meta.currentRound] = {
                ...currentRound,
                description: null,
                phase: 'reveal',
                submissions: {},
                scores: roundScores
            };

            await dynamodb.send(new UpdateCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId },
                UpdateExpression: 'SET gameplay.rounds = :rounds, players = :players',
                ExpressionAttributeValues: {
                    ':rounds': updatedRounds,
                    ':players': updatedPlayers
                }
            }));

            const updatedGame = await dynamodb.send(new GetCommand({
                TableName: process.env.GAMES_TABLE!,
                Key: { gameId }
            }));

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

            return;
        }
        
        // Normal flow - proceed to guessing phase with the provided description
        const description = draftDescription;
        
        // Initialize draft colors for guessing players
        const guessingPlayers = game.players.filter((p: any) => p.playerId !== currentRound.describerId);
        // Players keep their existing draft colors
        const updatedPlayers = game.players;
        
        const updatedRounds = [...game.gameplay.rounds];
        updatedRounds[game.meta.currentRound] = {
            ...currentRound,
            description,
            phase: 'guessing',
            timers: {
                ...currentRound.timers,
                guessingDeadline: new Date(Date.now() + game.config.guessingTimeLimit * 1000).toISOString()
            }
        };
        
        console.log('Setting guessing deadline - guessingTimeLimit:', game.config.guessingTimeLimit, 'type:', typeof game.config.guessingTimeLimit, 'deadline:', game.config.guessingTimeLimit === 0 ? null : new Date(Date.now() + game.config.guessingTimeLimit * 1000).toISOString());
        
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId },
            UpdateExpression: 'SET gameplay.rounds = :rounds, players = :players',
            ExpressionAttributeValues: {
                ':rounds': updatedRounds,
                ':players': updatedPlayers
            }
        }));
        
        const updatedGame = await dynamodb.send(new GetCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId }
        }));
        
        await broadcastToGame(gameId, {
            type: 'metaUpdated',
            meta: updatedGame.Item!.meta
        });

        await broadcastToGame(gameId, {
            type: 'gameplayUpdated',
            gameplay: updatedGame.Item!.gameplay
        });
    }
}

async function enforceGuessingDeadline(gameId: string): Promise<void> {
    const gameResult = await dynamodb.send(new GetCommand({
        TableName: process.env.GAMES_TABLE!,
        Key: { gameId }
    }));
    
    if (!gameResult.Item) return;
    
    const game = gameResult.Item;
    const currentRound = getCurrentRound(game);
    
    // Only enforce if still in guessing phase
    if (currentRound?.phase === 'guessing') {
        // Auto-submit draft colors for players who haven't submitted
        const submissions = { ...(currentRound.submissions || {}) };
        const players = game.players || [];
        
        // Find players who haven't submitted but have draft colors
        for (const player of players) {
            if (player.playerId !== currentRound.describerId && 
                !submissions[player.playerId] && 
                player.draftColor) {
                submissions[player.playerId] = player.draftColor;
            }
        }
        
        // Calculate scores for this round
        const targetColor = currentRound.targetColor;
        const roundScores: Record<string, number> = {};
        
        // Calculate scores for each guesser
        const guesserScores: number[] = [];
        Object.entries(submissions).forEach(([playerId, guessedColor]: [string, any]) => {
            const score = calculateColorScore(targetColor, guessedColor);
            roundScores[playerId] = score;
            guesserScores.push(score);
        });
        
        // Calculate describer score (average of all guesser scores)
        if (guesserScores.length > 0) {
            const averageScore = Math.round(guesserScores.reduce((sum, score) => sum + score, 0) / guesserScores.length);
            roundScores[currentRound.describerId] = averageScore;
        }
        
        const updatedRounds = [...game.gameplay.rounds];
        updatedRounds[game.meta.currentRound] = {
            ...currentRound,
            phase: 'reveal',
            submissions,
            scores: roundScores
        };
        
        // Update player total scores
        const updatedPlayers = game.players.map((player: any) => {
            let totalScore = 0;
            updatedRounds.forEach(round => {
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
                ':rounds': updatedRounds,
                ':players': updatedPlayers
            }
        }));
        
        const updatedGame = await dynamodb.send(new GetCommand({
            TableName: process.env.GAMES_TABLE!,
            Key: { gameId }
        }));
        
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
        });    }
}
