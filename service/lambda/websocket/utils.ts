import { HSLColor } from './types';
import { ScoringAlgorithm, geometricThresholdScoring } from './scoring';

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateGameId(): string {
    const alphabet = 'BCDFGHJKLMNPQRSTVWXZ'; // No vowels to avoid spelling words
    let codeChars = [
        alphabet[Math.floor(Math.random() * 20)],
        alphabet[Math.floor(Math.random() * 20)],
        alphabet[Math.floor(Math.random() * 20)]
    ];

    let serverCode;
    // Regional encoding based on AWS region
    switch (process.env.AWS_REGION) {
        case 'ap-southeast-2':
            serverCode = 'BC'; // Australia 🇦🇺
            break;
        case 'ap-northeast-1':
            serverCode = 'DF'; // Japan 🇯🇵
            break;
        case 'ap-southeast-1':
            serverCode = 'GH'; // Singapore 🇸🇬
            break;
        case 'ap-south-1':
            serverCode = 'JK'; // India 🇮🇳
            break;
        case 'eu-central-1':
            serverCode = 'LM'; // Europe 🇪🇺
            break;
        case 'eu-west-2':
            serverCode = 'NP'; // UK 🇬🇧
            break;
        case 'sa-east-1':
            serverCode = 'QR'; // Brazil 🇧🇷
            break;
        case 'us-east-1':
            serverCode = 'ST'; // US East 🇺🇸
            break;
        case 'us-west-2':
            serverCode = 'VW'; // US West 🇺🇸
            break;
        default:
            serverCode = 'XZ'; // Local or Fallback
    }
    
    // Add random character from region's character pair
    codeChars.push(serverCode[Math.floor(Math.random() * serverCode.length)]);
    
    return codeChars.join('');
}

export function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export function isValidHSLColor(color: HSLColor): boolean {
    const { h, s, l } = color;
    return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

export function generateRandomHSLColor(): HSLColor {
    return {
        h: Math.floor(Math.random() * 361),
        s: Math.floor(Math.random() * 91) + 10, // 10-100%
        l: Math.floor(Math.random() * 81) + 15  // 15-95%
    };
}

// ============================================================================
// SCORING
// ============================================================================

// Current scoring algorithm - easy to swap
const CURRENT_SCORING_ALGORITHM: ScoringAlgorithm = geometricThresholdScoring;

export function calculateColorScore(targetColor: any, guessedColor: any): number {
    return CURRENT_SCORING_ALGORITHM(targetColor, guessedColor);
}

// ============================================================================
// GAME STATE UTILITIES
// ============================================================================

export function getCurrentRound(game: any): any | null {
    if (game.meta.currentRound === null || game.meta.currentRound === undefined) {
        return null;
    }
    return game.gameplay.rounds[game.meta.currentRound] || null;
}

export function findLastSubmittedColor(game: any, playerId: string): HSLColor | null {
    const rounds = game.gameplay.rounds || [];
    for (let i = rounds.length - 1; i >= 0; i--) {
        const round = rounds[i];
        if (round.submissions && round.submissions[playerId]) {
            return round.submissions[playerId];
        }
    }
    return null;
}

export function shouldEndGame(game: any): boolean {
    const turnsPerPlayer = game.config.turnsPerPlayer;
    const players = game.players;
    const rounds = game.gameplay.rounds || [];
    
    // Count how many times each player has been a describer
    const describerCounts: Record<string, number> = {};
    players.forEach((player: any) => {
        describerCounts[player.playerId] = 0;
    });
    
    rounds.forEach((round: any) => {
        if (round.describerId && describerCounts[round.describerId] !== undefined) {
            describerCounts[round.describerId]++;
        }
    });
    
    // Check if all players have given at least turnsPerPlayer clues
    return players.every((player: any) => 
        describerCounts[player.playerId] >= turnsPerPlayer
    );
}
