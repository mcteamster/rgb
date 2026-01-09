import { useMemo } from 'react';
import { useGame } from '../contexts/GameContext';
import { findHostPlayer } from '../utils/gameUtils';

/**
 * Hook to determine if current player is the host
 */
export const useIsHost = (): boolean => {
  const { gameState, playerId } = useGame();
  
  return useMemo(() => {
    if (!playerId || !gameState?.players?.length) return false;
    
    const hostPlayer = findHostPlayer(gameState.players);
    return hostPlayer?.playerId === playerId;
  }, [gameState?.players, playerId]);
};
