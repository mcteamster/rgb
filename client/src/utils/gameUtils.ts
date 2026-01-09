import { Player } from '../types/game';

/**
 * Calculate player rankings based on total scores
 */
export const calculatePlayerRankings = (players: Player[]): Record<string, number> => {
  return players
    .map(player => ({ ...player, totalScore: player.score || 0 }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .reduce((rankings, player, index, sortedPlayers) => {
      if (index === 0) {
        rankings[player.playerId] = 1;
      } else {
        const prevPlayer = sortedPlayers[index - 1];
        if (player.totalScore === prevPlayer.totalScore) {
          rankings[player.playerId] = rankings[prevPlayer.playerId];
        } else {
          rankings[player.playerId] = index + 1;
        }
      }
      return rankings;
    }, {} as Record<string, number>);
};

/**
 * Find the host player (earliest joined)
 */
export const findHostPlayer = (players: Player[]): Player | null => {
  if (players.length === 0) return null;
  
  return players.reduce((earliest, player) =>
    new Date(player.joinedAt) < new Date(earliest.joinedAt) ? player : earliest
  );
};
