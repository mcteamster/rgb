import React from 'react';
import { useGame } from '../contexts/GameContext';

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useGame();

  return (
    <div 
      className="connection-status"
      style={{
        position: 'fixed',
        top: 'calc(10px + var(--header-offset))',
        right: '10px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: isConnected ? '#22c55e' : '#ef4444',
        zIndex: 1000,
        boxShadow: '0 0 4px rgba(0,0,0,0.3)'
      }}
      title={isConnected ? 'Connected' : 'Disconnected'}
    />
  );
};
