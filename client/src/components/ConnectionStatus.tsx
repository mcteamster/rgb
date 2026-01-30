import React from 'react';
import { useGame } from '../contexts/GameContext';

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useGame();

  return (
    <div 
      className="connection-status"
      style={{
        backgroundColor: isConnected ? '#22c55e' : '#ef4444',
      }}
      title={isConnected ? 'Connected' : 'Disconnected'}
    />
  );
};
