import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { WebSocketMessage } from './types';
import { validatePlayerAction } from './validation';
import { checkAndEnforceDeadlines } from './deadlines';
import { 
    handleCreateGame, 
    handleGetGame, 
    handleJoinGame, 
    handleRejoinGame, 
    handleKickPlayer 
} from './game-handlers';
import { 
    handleUpdateDraftDescription, 
    handleSubmitDescription, 
    handleUpdateDraftColor, 
    handleSubmitColor, 
    handleStartRound,
    handleFinaliseGame,
    handleResetGame,
    handleCloseRoom
} from './round-handlers';

export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
    const { connectionId } = event.requestContext;
    const { action, gameId, playerId, playerName, config, data }: WebSocketMessage = JSON.parse(event.body!);
    
    console.log('WebSocket message received:', { action, gameId, playerId, connectionId });
    
    try {
        // Actions that don't require validation
        if (['createGame', 'joinGame', 'rejoinGame'].includes(action)) {
            switch (action) {
                case 'createGame':
                    return await handleCreateGame(connectionId, playerName!, config);
                case 'joinGame':
                    return await handleJoinGame(connectionId, gameId!, playerName!);
                case 'rejoinGame':
                    return await handleRejoinGame(connectionId, gameId!, playerId!);
            }
        }

        // Validate player authorization for all other actions
        if (gameId && playerId) {
            const validationResult = await validatePlayerAction(connectionId, gameId, playerId);
            if (validationResult.statusCode !== 200) {
                return { statusCode: validationResult.statusCode };
            }
        }

        switch (action) {
            case 'getGame':
                return await handleGetGame(connectionId, gameId!);
            case 'submitColor':
                console.log('Submit color data:', data);
                await checkAndEnforceDeadlines(gameId!);
                return await handleSubmitColor(connectionId, gameId!, playerId!, data!.color!);
            case 'updateDraftColor':
                return await handleUpdateDraftColor(connectionId, gameId!, playerId!, data!.color!);
            case 'updateDraftDescription':
                return await handleUpdateDraftDescription(connectionId, gameId!, playerId!, data!.description!);
            case 'kickPlayer':
                const targetPlayerId = data?.targetPlayerId || playerId!;
                const reason = targetPlayerId === playerId ? 'leave' : 'kick';
                return await handleKickPlayer(connectionId, gameId!, playerId!, targetPlayerId, reason);
            case 'submitDescription':
                await checkAndEnforceDeadlines(gameId!);
                return await handleSubmitDescription(connectionId, gameId!, playerId!, data!.description!);
            case 'startRound':
                return await handleStartRound(connectionId, gameId!, playerId!);
            case 'finaliseGame':
                return await handleFinaliseGame(connectionId, gameId!, playerId!);
            case 'resetGame':
                return await handleResetGame(connectionId, gameId!, playerId!);
            case 'closeRoom':
                return await handleCloseRoom(connectionId, gameId!, playerId!);
            default:
                return { statusCode: 400 };
        }
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500 };
    }
};
