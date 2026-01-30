import { HSLColor } from '../types/game';
import { Virgo2AWS } from '@mcteamster/virgo';
import { AWS_REGIONS, ENDPOINTS } from '../constants/regions';
import { convertToServerColor } from '../utils/colorUtils';

let selectedRegion: string | null = localStorage.getItem('rgb-region');

// Auto-detect closest region if not set
if (!selectedRegion) {
  try {
    const { closestRegion } = Virgo2AWS.getClosestRegion({ 
      regions: Object.keys(AWS_REGIONS) 
    });
    selectedRegion = AWS_REGIONS[closestRegion as keyof typeof AWS_REGIONS] || 'AU';
    localStorage.setItem('rgb-region', selectedRegion);
    console.info(`Auto-selected region: ${selectedRegion} (${closestRegion})`);
  } catch (error) {
    selectedRegion = 'AU'; // Fallback
    console.warn('Failed to detect region, using AU:', error);
  }
}

export interface WebSocketMessage {
  action: string;
  gameId?: string;
  playerId?: string;
  playerName?: string;
  data?: {
    color?: HSLColor;
    description?: string;
    targetPlayerId?: string;
  };
  config?: {
    maxPlayers?: number;
    descriptionTimeLimit?: number;
    guessingTimeLimit?: number;
  };
}

export interface GameEvent {
  type: string;
  gameId?: string;
  playerId?: string;
  joinedPlayerId?: string;
  playerCount?: number;
  color?: HSLColor;
  targetColor?: HSLColor;
  round?: any;
  description?: string;
  phase?: string;
  gameState?: any;
  meta?: any;
  players?: any[];
  gameplay?: any;
  config?: any;
  error?: string;
  message?: string;
  status?: string;
}

export interface WebSocketCallbacks {
  onMetaUpdated: (meta: any) => void;
  onPlayersUpdated: (players: any[]) => void;
  onGameplayUpdated: (gameplay: any) => void;
  onGameStateUpdated: (gameState: any) => void;
  onError: (error: string) => void;
  onConnectionStatus: (connected: boolean) => void;
  onKicked: (message: string) => void;
}

export class GameWebSocket {
  private ws: WebSocket | null = null;
  public gameId: string | null = null;
  public playerId: string | null = null;
  private eventHandlers: Map<string, ((event: GameEvent) => void)[]> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private callbacks?: WebSocketCallbacks;

  constructor(callbacks?: WebSocketCallbacks) {
    this.callbacks = callbacks;
    
    this.on('gameStateUpdated', (event: GameEvent) => {
      for (const [key, pending] of this.pendingRequests.entries()) {
        if (key.startsWith('gameStateUpdated_')) {
          this.pendingRequests.delete(key);
          if (event.gameState?.gameId) {
            this.gameId = event.gameState.gameId;
          }
          if (event.playerId) {
            this.playerId = event.playerId;
            console.debug('🎮 Player joined/created, starting sync polling');
            this.startSyncPolling();
          }
          pending.resolve(event);
          break;
        }
      }
      
      // Handle UI updates
      if (this.callbacks && event.gameState) {
        this.callbacks.onGameStateUpdated(event.gameState);
      }
    });

    this.on('metaUpdated', (event: GameEvent) => {
      if (this.callbacks && event.meta) {
        this.callbacks.onMetaUpdated(event.meta);
      }
    });

    this.on('playersUpdated', (event: GameEvent) => {
      if (this.callbacks && event.players) {
        this.callbacks.onPlayersUpdated(event.players);
      }
    });

    this.on('gameplayUpdated', (event: GameEvent) => {
      if (this.callbacks && event.gameplay) {
        this.callbacks.onGameplayUpdated(event.gameplay);
      }
    });

    this.on('error', (event: GameEvent) => {
      // Handle pending requests
      const hasPendingRequests = this.pendingRequests.size > 0;
      for (const [key, pending] of this.pendingRequests.entries()) {
        this.pendingRequests.delete(key);
        pending.reject(new Error(event.error || 'Request failed'));
      }
      
      // Only show UI error if there were no pending requests (to avoid duplicates)
      if (!hasPendingRequests && this.callbacks) {
        this.callbacks.onError(event.error || 'Unknown error');
      }
    });

    this.on('connectionStatus', (event: GameEvent) => {
      if (this.callbacks) {
        this.callbacks.onConnectionStatus(event.status === 'connected');
      }
    });

    this.on('kicked', (event: GameEvent) => {
      if (this.callbacks) {
        this.callbacks.onKicked(event.message || 'You have been removed from the game');
      }
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentRegion = localStorage.getItem('rgb-region') || 'AU';
      const wsUrl = ENDPOINTS[currentRegion as keyof typeof ENDPOINTS] || ENDPOINTS.DEFAULT;
      
      this.ws = new WebSocket(wsUrl);
      console.debug(`🟢 Connecting to RGB WebSocket: ${wsUrl} (${currentRegion})`);

      this.ws.onopen = () => {
        console.debug('🟢 WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // Emit connection status
        const handlers = this.eventHandlers.get('connectionStatus');
        if (handlers && handlers.length > 0) {
          handlers.forEach(handler => handler({ type: 'connectionStatus', status: 'connected' }));
        }
        
        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message) {
            console.debug('🔼 Sending queued message:', message.action);
            this.send(message);
          }
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: GameEvent = JSON.parse(event.data);
          console.debug('🔽 WebSocket received:', message.type, message);
          const handlers = this.eventHandlers.get(message.type);
          if (handlers && handlers.length > 0) {
            handlers.forEach(handler => handler(message));
          } else {
            console.warn('No handler for message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.debug('🔴 WebSocket connection closed:', event.code, event.reason);
        
        // Emit connection status
        const handlers = this.eventHandlers.get('connectionStatus');
        if (handlers && handlers.length > 0) {
          handlers.forEach(handler => handler({ type: 'connectionStatus', status: 'disconnected' }));
        }
        
        this.attemptReconnect();
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.debug(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
        .then(() => {
          console.debug('✅ Reconnected successfully');
          // Rejoin game if we have session info
          if (this.gameId && this.playerId) {
            console.debug('🔄 Rejoining game after reconnect');
            this.send({
              action: 'rejoinGame',
              gameId: this.gameId,
              playerId: this.playerId
            });
            console.debug('🎮 After reconnect, starting sync polling');
            this.startSyncPolling();
          }
        })
        .catch(() => {
          // Exponential backoff
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
          this.attemptReconnect();
        });
    }, this.reconnectDelay);
  }

  createGame(playerName: string, config?: { maxPlayers?: number; descriptionTimeLimit?: number; guessingTimeLimit?: number }): Promise<GameEvent> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      this.pendingRequests.set(`gameStateUpdated_${requestId}`, { resolve, reject });
      
      setTimeout(() => {
        const pending = this.pendingRequests.get(`gameStateUpdated_${requestId}`);
        if (pending) {
          this.pendingRequests.delete(`gameStateUpdated_${requestId}`);
          pending.reject(new Error('Request timeout'));
        }
      }, 10000);

      this.send({ action: 'createGame', playerName, config });
    });
  }

  joinGame(gameId: string, playerName: string): Promise<GameEvent> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      this.pendingRequests.set(`gameStateUpdated_${requestId}`, { resolve, reject });
      
      setTimeout(() => {
        const pending = this.pendingRequests.get(`gameStateUpdated_${requestId}`);
        if (pending) {
          this.pendingRequests.delete(`gameStateUpdated_${requestId}`);
          pending.reject(new Error('Request timeout'));
        }
      }, 10000);

      this.send({
        action: 'joinGame',
        gameId,
        playerName,
      });
    });
  }

  getGameState(gameId: string): void {
    this.send({
      action: 'getGame',
      gameId,
      playerId: this.playerId || undefined,
    });
  }

  updateDraftDescription(description: string): void {
    if (!this.gameId || !this.playerId) {
      return;
    }

    this.send({
      action: 'updateDraftDescription',
      gameId: this.gameId,
      playerId: this.playerId,
      data: { description },
    });
  }

  submitDescription(description: string): void {
    if (!this.gameId || !this.playerId) {
      throw new Error('Must join game before submitting description');
    }

    this.send({
      action: 'submitDescription',
      gameId: this.gameId,
      playerId: this.playerId,
      data: { description },
    });
  }

  updateDraftColor(color: HSLColor): void {
    if (!this.gameId || !this.playerId) {
      return;
    }

    const serverColor = convertToServerColor(color);

    this.send({
      action: 'updateDraftColor',
      gameId: this.gameId,
      playerId: this.playerId,
      data: { color: serverColor },
    });
  }

  submitColor(color: HSLColor): void {
    console.log('WebSocket submitColor called with:', color);
    if (!this.gameId || !this.playerId) {
      console.error('Cannot submit color: gameId or playerId missing', { gameId: this.gameId, playerId: this.playerId });
      throw new Error('Must join game before submitting color');
    }

    const message = {
      action: 'submitColor',
      gameId: this.gameId,
      playerId: this.playerId,
      data: { color },
    };
    console.log('Sending WebSocket message:', message);
    this.send(message);
  }

  kickPlayer(targetPlayerId: string): void {
    if (!this.gameId || !this.playerId) {
      return;
    }

    this.send({
      action: 'kickPlayer',
      gameId: this.gameId,
      playerId: this.playerId,
      data: { targetPlayerId },
    });
  }

  leaveGame(): void {
    if (!this.gameId || !this.playerId) {
      return;
    }

    this.stopSyncPolling();
    
    // Send kick message to remove player from game
    this.send({
      action: 'kickPlayer',
      gameId: this.gameId,
      data: { targetPlayerId: this.playerId }
    });
    
    // Clear game session but keep connection open
    this.gameId = null;
    this.playerId = null;
    
    // Clear any pending requests
    this.pendingRequests.clear();
  }

  startRound(): void {
    if (!this.gameId || !this.playerId) {
      throw new Error('Must join game before starting round');
    }

    this.send({
      action: 'startRound',
      gameId: this.gameId,
      playerId: this.playerId,
    });
  }

  finaliseGame(): void {
    if (!this.gameId || !this.playerId) {
      throw new Error('Must join game before finalising game');
    }

    this.send({
      action: 'finaliseGame',
      gameId: this.gameId,
      playerId: this.playerId,
    });
  }

  resetGame(): void {
    if (!this.gameId || !this.playerId) {
      throw new Error('Must join game before resetting game');
    }

    this.send({
      action: 'resetGame',
      gameId: this.gameId,
      playerId: this.playerId,
    });
  }

  closeRoom(): void {
    if (!this.gameId || !this.playerId) {
      throw new Error('Must join game before closing room');
    }

    this.send({
      action: 'closeRoom',
      gameId: this.gameId,
      playerId: this.playerId,
    });
  }

  on(eventType: string, handler: (event: GameEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string): void {
    this.eventHandlers.delete(eventType);
  }

  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    this.stopSyncPolling();
    
    if (this.ws) {
      // Use proper close code for normal closure
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.gameId = null;
    this.playerId = null;
    this.eventHandlers.clear();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
  }

  public send(message: WebSocketMessage): void {
    console.debug('🔼 WebSocket sending:', message.action, message);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.debug('WebSocket is open, sending message');
      this.ws.send(JSON.stringify(message));
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.debug('WebSocket is connecting, queueing message');
      // Queue message if still connecting
      this.messageQueue.push(message);
    } else {
      console.error('WebSocket is not connected, readyState:', this.ws?.readyState);
      throw new Error('WebSocket is not connected');
    }
  }

  public startSyncPolling(): void {
    this.stopSyncPolling();
    console.debug('🔄 Starting sync polling every 5 seconds');
    this.syncIntervalId = setInterval(() => {
      if (this.gameId) {
        console.debug('⏰ Sync polling - sending getGame request');
        this.getGameState(this.gameId);
      } else {
        console.debug('⏰ Sync polling skipped - no gameId');
      }
    }, 10000); // 10 second sync polling
  }

  private stopSyncPolling(): void {
    if (this.syncIntervalId) {
      console.debug('🛑 Stopping sync polling');
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }
}
