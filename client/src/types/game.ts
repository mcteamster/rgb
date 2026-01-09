export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface Player {
  playerId: string;
  playerName: string;
  joinedAt: string;
  score?: number;
  draftColor?: HSLColor;
  draftDescription?: string;
}

export interface GameRound {
  targetColor: HSLColor;
  startedAt: string;
  describerId?: string;
  description?: string;
  phase?: 'describing' | 'guessing' | 'reveal' | 'endgame';
  submissions: Record<string, HSLColor>;
  scores?: Record<string, number>;
  timers?: {
    descriptionDeadline?: string; // ISO timestamp when description phase ends
    guessingDeadline?: string;    // ISO timestamp when guessing phase ends
  };
}

export interface GameConfig {
  maxPlayers: number;
  descriptionTimeLimit: number; // seconds
  guessingTimeLimit: number;    // seconds
  turnsPerPlayer: number;       // number of turns each player gets to describe
}

export interface GameState {
  gameId: string;
  config: GameConfig;
  meta: {
    status: 'waiting' | 'playing' | 'finished';
    currentRound: number | null; // Index into gameplay.rounds array
    createdAt: string;
  };
  players: Player[];
  gameplay: {
    rounds: GameRound[];
  };
}

export interface GameEvent {
  type: 'gameCreated' | 'gameState' | 'gameStateUpdated' | 'playerJoined' | 'error' 
       | 'metaUpdated' | 'playersUpdated' | 'gameplayUpdated' | 'configUpdated' | 'kicked';
  gameId?: string;
  playerId?: string;
  playerCount?: number;
  status?: string;
  error?: string;
  message?: string;
  gameState?: GameState;
  meta?: GameState['meta'];
  players?: Player[];
  gameplay?: GameState['gameplay'];
  config?: GameState['config'];
}

export interface CreateGameResponse {
  gameId: string;
  status: string;
}

export interface JoinGameResponse {
  playerId: string;
  gameId: string;
  playerCount: number;
}
