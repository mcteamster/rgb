export interface HSLColor {
    h: number;
    s: number;
    l: number;
}

export interface WebSocketMessage {
    action: string;
    gameId?: string;
    playerId?: string;
    playerName?: string;
    config?: {
        maxPlayers?: number;
        descriptionTimeLimit?: number;
        guessingTimeLimit?: number;
    };
    data?: {
        color?: HSLColor;
        description?: string;
        targetPlayerId?: string;
    };
}
