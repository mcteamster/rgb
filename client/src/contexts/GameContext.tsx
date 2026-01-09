import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { GameState, HSLColor, Player, GameRound } from '../types/game';
import { GameWebSocket } from '../services/gameWebSocket';
import { getRegionFromCode, API_BASE_URL } from '../constants/regions';

interface GameContextState {
  gameState: GameState | null;
  playerId: string | null;
  playerName: string | null;
  savedPlayerName: string;
  isConnected: boolean;
  isRejoining: boolean;
  rejoinGameId: string | null;
  error: string[];
}

interface GameContextActions {
  createGame: (playerName: string, config?: { maxPlayers?: number; descriptionTimeLimit?: number; guessingTimeLimit?: number; turnsPerPlayer?: number }) => Promise<void>;
  joinGame: (gameId: string, playerName: string) => Promise<void>;
  rejoinGame: (gameId: string, playerId: string, playerName: string) => Promise<void>;
  updateDraftColor: (color: HSLColor) => void;
  kickPlayer: (targetPlayerId: string) => void;
  submitColor: (color: HSLColor) => void;
  updateDraftDescription: (description: string) => void;
  submitDescription: (description: string) => void;
  startRound: () => void;
  finaliseGame: () => void;
  resetGame: () => void;
  closeRoom: () => void;
  getCurrentRound: () => GameRound | null;
  exitGame: () => void;
  clearError: (index?: number) => void;
  showGameResults: boolean;
  setShowGameResults: (show: boolean) => void;
  currentRegion: string;
  setRegion: (region: string) => void;
}

type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SET_PLAYER'; payload: { playerId: string; playerName: string } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR'; payload?: number }
  | { type: 'SET_REJOINING'; payload: { isRejoining: boolean; gameId?: string } }
  | { type: 'META_UPDATED'; payload: { meta: GameState['meta'] } }
  | { type: 'PLAYERS_UPDATED'; payload: { players: Player[] } }
  | { type: 'GAMEPLAY_UPDATED'; payload: { gameplay: GameState['gameplay'] } }
  | { type: 'RESET_GAME' };

const STORAGE_KEY = 'rgb-game-session';
const PLAYER_NAME_KEY = 'rgb-player-name';

interface GameSession {
  gameId: string;
  playerId: string;
  playerName: string;
}

const saveSession = (session: GameSession) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const loadSession = (): GameSession | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const savePlayerName = (name: string) => {
  localStorage.setItem(PLAYER_NAME_KEY, name);
};

const loadPlayerName = (): string => {
  return localStorage.getItem(PLAYER_NAME_KEY) || '';
};

const initialState: GameContextState = {
  gameState: null,
  playerId: null,
  playerName: null,
  savedPlayerName: loadPlayerName(),
  isConnected: false,
  isRejoining: false,
  rejoinGameId: null,
  error: [],
};

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    case 'SET_PLAYER':
      return { 
        ...state, 
        playerId: action.payload.playerId, 
        playerName: action.payload.playerName 
      };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_ERROR':
      return { ...state, error: [...state.error, action.payload] };
    case 'CLEAR_ERROR':
      if (action.payload !== undefined) {
        return { ...state, error: state.error.filter((_, i) => i !== action.payload) };
      }
      return { ...state, error: [] };
    case 'SET_REJOINING':
      return {
        ...state,
        isRejoining: action.payload.isRejoining,
        rejoinGameId: action.payload.gameId || null
      };
    case 'META_UPDATED':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          meta: action.payload.meta
        }
      };
    case 'PLAYERS_UPDATED':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          players: action.payload.players
        }
      };
    case 'GAMEPLAY_UPDATED':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          gameplay: action.payload.gameplay
        }
      };
    case 'RESET_GAME':
      return {
        ...initialState,
        savedPlayerName: state.savedPlayerName // Preserve saved player name
      };
    default:
      return state;
  }
}

const GameContext = createContext<(GameContextState & GameContextActions) | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [showGameResults, setShowGameResults] = React.useState(false);
  const [currentRegion, setCurrentRegion] = React.useState(() => {
    return localStorage.getItem('rgb-region') || 'AU';
  });
  const wsRef = React.useRef<GameWebSocket | null>(null);
  const stateRef = React.useRef(state);
  
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Save session when player joins
  useEffect(() => {
    if (state.gameState && state.playerId && state.playerName) {
      saveSession({
        gameId: state.gameState.gameId,
        playerId: state.playerId,
        playerName: state.playerName
      });
    }
  }, [state.gameState, state.playerId, state.playerName]);

  const rejoinGame = useCallback(async (gameId: string, playerId: string, playerName: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      dispatch({ type: 'SET_REJOINING', payload: { isRejoining: true, gameId } });
      
      // Check if room code indicates different region
      const roomRegion = getRegionFromCode(gameId);
      if (roomRegion !== currentRegion) {
        console.log(`Switching region from ${currentRegion} to ${roomRegion} for rejoin ${gameId}`);
        setRegion(roomRegion);
        // Wait a moment for region switch to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Initialize WebSocket if needed
      if (!wsRef.current) {
        initializeWebSocket();
      }
      
      // Connect WebSocket
      if (wsRef.current) {
        await wsRef.current.connect();
        dispatch({ type: 'SET_CONNECTED', payload: true });
      }

      // Send rejoin request - server will respond with gameStateUpdated
      await wsRef.current!.send({
        action: 'rejoinGame',
        gameId,
        playerId
      });

      // Set player data from saved session
      wsRef.current!.gameId = gameId;
      wsRef.current!.playerId = playerId;
      dispatch({ 
        type: 'SET_PLAYER', 
        payload: { playerId, playerName } 
      });

      // Start sync polling
      wsRef.current!.startSyncPolling();

      dispatch({ type: 'SET_REJOINING', payload: { isRejoining: false } });
    } catch (error) {
      // Game doesn't exist or other error - clear session
      clearSession();
      dispatch({ type: 'SET_REJOINING', payload: { isRejoining: false } });
    }
  }, []);

  const initializeWebSocket = () => {
    const ws = new GameWebSocket({
      onMetaUpdated: (meta) => {
        console.log('Received metaUpdated event:', meta);
        dispatch({
          type: 'META_UPDATED',
          payload: { meta }
        });
      },
      onPlayersUpdated: (players) => {
        dispatch({
          type: 'PLAYERS_UPDATED',
          payload: { players }
        });
      },
      onGameplayUpdated: (gameplay) => {
        console.log('Received gameplayUpdated event:', gameplay);
        dispatch({
          type: 'GAMEPLAY_UPDATED',
          payload: { gameplay }
        });
      },
      onGameStateUpdated: (gameState) => {
        console.debug('Received gameStateUpdated event:', gameState);
        const currentGameState = stateRef.current.gameState;
        
        if (currentGameState) {
          // Check for specific field updates and dispatch targeted events
          if (JSON.stringify(currentGameState.players) !== JSON.stringify(gameState.players)) {
            dispatch({
              type: 'PLAYERS_UPDATED',
              payload: { players: gameState.players }
            });
          }
          
          if (JSON.stringify(currentGameState.meta) !== JSON.stringify(gameState.meta)) {
            dispatch({
              type: 'META_UPDATED',
              payload: { meta: gameState.meta }
            });
          }
          
          if (JSON.stringify(currentGameState.gameplay) !== JSON.stringify(gameState.gameplay)) {
            dispatch({
              type: 'GAMEPLAY_UPDATED',
              payload: { gameplay: gameState.gameplay }
            });
          }
        }
        
        // Always update the full game state
        dispatch({
          type: 'SET_GAME_STATE',
          payload: gameState
        });
      },
      onError: (error) => {
        dispatch({
          type: 'SET_ERROR',
          payload: error
        });
      },
      onConnectionStatus: (connected) => {
        dispatch({
          type: 'SET_CONNECTED',
          payload: connected
        });
      },
      onKicked: (message) => {
        // Disconnect WebSocket when kicked
        if (wsRef.current) {
          wsRef.current.disconnect();
          wsRef.current = null;
        }
        
        // Clear game session but keep player name (same as exitGame)
        clearSession();
        
        // Clear game state when kicked
        dispatch({ type: 'RESET_GAME' });
        
        // Show kick/closure message as error
        dispatch({ type: 'SET_ERROR', payload: message });
      }
    });
    
    wsRef.current = ws;
    return ws;
  };

  useEffect(() => {
    initializeWebSocket();

    // Try to restore session after WebSocket is initialized
    const currentPath = window.location.pathname.slice(1);
    const isValidRoomCode = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(currentPath);
    
    if (!isValidRoomCode) {
      const session = loadSession();
      if (session) {
        rejoinGame(session.gameId, session.playerId, session.playerName);
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [rejoinGame]);

  const createGame = async (playerName: string, config?: { maxPlayers?: number; descriptionTimeLimit?: number; guessingTimeLimit?: number; turnsPerPlayer?: number }) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      savePlayerName(playerName);
      
      // Initialize WebSocket if needed
      if (!wsRef.current) {
        initializeWebSocket();
      }
      
      // Connect WebSocket
      if (wsRef.current) {
        await wsRef.current.connect();
        dispatch({ type: 'SET_CONNECTED', payload: true });
      }

      // Create the game with player name and optional config - server will auto-join the creator
      const createResponse = await wsRef.current!.createGame(playerName, config);
      
      // Set player data from the response
      wsRef.current!.gameId = createResponse.gameState!.gameId;
      wsRef.current!.playerId = createResponse.playerId!;
      dispatch({ 
        type: 'SET_PLAYER', 
        payload: { playerId: createResponse.playerId!, playerName } 
      });

      // Publish room code for Discord activities
      if (localStorage.getItem('instance_id')) {
        fetch(`${API_BASE_URL}/common/rooms/${localStorage.getItem('instance_id')}/${createResponse.gameState!.gameId}?game=rgb`, {
          method: "PUT",
        }).catch(console.error);
      } else {
        fetch(`${API_BASE_URL}/common/rooms/${createResponse.gameState!.gameId}/${createResponse.gameState!.gameId}?game=rgb`, {
          method: "PUT",
        }).catch(console.error);
      }

      // Start sync polling
      wsRef.current!.startSyncPolling();

      // Game state is already set by the gameStateUpdated handler
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const joinGame = async (gameId: string, playerName: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      savePlayerName(playerName);
      
      // Check if room code indicates different region
      const roomRegion = getRegionFromCode(gameId);
      if (roomRegion !== currentRegion) {
        console.log(`Switching region from ${currentRegion} to ${roomRegion} for room ${gameId}`);
        setRegion(roomRegion);
        // Wait a moment for region switch to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Initialize WebSocket if needed
      if (!wsRef.current) {
        initializeWebSocket();
      }
      
      // Connect WebSocket first
      if (wsRef.current) {
        await wsRef.current.connect();
        dispatch({ type: 'SET_CONNECTED', payload: true });
      }

      // Join game - server will respond with full game state
      const response = await wsRef.current!.joinGame(gameId, playerName);
      
      // Set player data from the response
      wsRef.current!.gameId = response.gameState!.gameId;
      wsRef.current!.playerId = response.playerId!;
      dispatch({ 
        type: 'SET_PLAYER', 
        payload: { playerId: response.playerId!, playerName } 
      });

      // Start sync polling
      wsRef.current!.startSyncPolling();

      // Game state is already set by the gameStateUpdated handler
    } catch (error) {
      // Clear session if join fails (game might not exist)
      clearSession();
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const updateDraftDescription = (description: string) => {
    try {
      if (wsRef.current) {
        wsRef.current.updateDraftDescription(description);
      }
    } catch (error) {
      console.error('Error in updateDraftDescription:', error);
    }
  };

  const submitDescription = (description: string) => {
    try {
      if (wsRef.current) {
        wsRef.current.submitDescription(description);
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const updateDraftColor = (color: HSLColor) => {
    try {
      if (wsRef.current) {
        wsRef.current.updateDraftColor(color);
      }
    } catch (error) {
      console.error('Error in updateDraftColor:', error);
    }
  };

  const kickPlayer = (targetPlayerId: string) => {
    try {
      if (wsRef.current) {
        wsRef.current.kickPlayer(targetPlayerId);
      }
    } catch (error) {
      console.error('Error in kickPlayer:', error);
    }
  };

  const submitColor = (color: HSLColor) => {
    console.log('GameContext submitColor called with:', color);
    try {
      if (wsRef.current) {
        console.log('Calling wsRef.current.submitColor');
        wsRef.current.submitColor(color);
      } else {
        console.log('wsRef.current is null');
      }
    } catch (error) {
      console.error('Error in submitColor:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const getCurrentRound = (): GameRound | null => {
    if (!state.gameState || state.gameState.meta.currentRound === null) {
      return null;
    }
    return state.gameState.gameplay.rounds[state.gameState.meta.currentRound] || null;
  };

  const startRound = () => {
    try {
      if (wsRef.current) {
        wsRef.current.startRound();
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const finaliseGame = () => {
    try {
      if (wsRef.current) {
        wsRef.current.finaliseGame();
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const resetGame = () => {
    try {
      if (wsRef.current) {
        wsRef.current.resetGame();
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const closeRoom = () => {
    try {
      if (wsRef.current) {
        wsRef.current.closeRoom();
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  const exitGame = () => {
    try {
      if (wsRef.current) {
        wsRef.current.leaveGame();
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      
      // Clear game session but keep player name
      clearSession();
      dispatch({ type: 'RESET_GAME' });
    } catch (error) {
      console.error('Error in exitGame:', error);
    }
  };

  const setRegion = useCallback((region: string) => {
    setCurrentRegion(region);
    localStorage.setItem('rgb-region', region);
    
    // Disconnect current WebSocket if connected
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    
    // Reinitialize with new region
    initializeWebSocket();
  }, []);

  const clearError = (index?: number) => {
    dispatch({ type: 'CLEAR_ERROR', payload: index });
  };

  return (
    <GameContext.Provider
      value={{
        ...state,
        createGame,
        joinGame,
        rejoinGame,
        updateDraftColor,
        kickPlayer,
        submitColor,
        updateDraftDescription,
        submitDescription,
        startRound,
        finaliseGame,
        resetGame,
        closeRoom,
        getCurrentRound,
        exitGame,
        clearError,
        showGameResults,
        setShowGameResults,
        currentRegion,
        setRegion,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
