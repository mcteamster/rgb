import { HSLColor } from './types';

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

// Calculate score based on HSL color distance
export function calculateColorScore(targetColor: any, guessedColor: any): number {
    // Normalize hue difference (0-360 wraps around)
    let hueDiff = Math.abs(targetColor.h - guessedColor.h);
    if (hueDiff > 180) {
        hueDiff = 360 - hueDiff;
    }
    
    // Calculate differences
    const satDiff = targetColor.s - guessedColor.s;
    const lightDiff = targetColor.l - guessedColor.l;
    
    // Weight saturation by distance from extreme lightness
    const avgLightness = (targetColor.l + guessedColor.l) / 2;
    const lightWeight = 1 - Math.abs(avgLightness - 50) / 50; // 0 at L=0/100, 1 at L=50
    
    // Weight hue by saturation and lightness
    const avgSaturation = (targetColor.s + guessedColor.s) / 200; // 0-1 scale
    const hueWeight = avgSaturation * lightWeight;
    
    // Normalize to 0-1 scale for distance calculation
    const normalizedHueDiff = (hueDiff / 180) * hueWeight; // weighted by saturation and lightness
    const normalizedSatDiff = (satDiff / 100) * lightWeight; // weighted by lightness
    const normalizedLightDiff = lightDiff / 100; // 0-1 scale
    
    const distance = Math.sqrt(
        normalizedHueDiff * normalizedHueDiff +
        normalizedSatDiff * normalizedSatDiff + 
        normalizedLightDiff * normalizedLightDiff
    );
    
    // Convert distance to score (0-100 points)
    const maxDistance = Math.sqrt(1 + lightWeight * lightWeight + hueWeight * hueWeight);
    const score = Math.max(0, Math.round(100 * (1 - distance / maxDistance)));
    
    return score;
}

// Check if all players have given the required number of clues
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
