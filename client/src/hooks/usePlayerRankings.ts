import { useMemo } from 'react';
import { Player } from '../types/game';
import { calculatePlayerRankings } from '../utils/gameUtils';

/**
 * Hook to calculate and memoize player rankings
 */
export const usePlayerRankings = (players: Player[]): Record<string, number> => {
  return useMemo(() => calculatePlayerRankings(players), [players]);
};
