import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { RoomMenu } from './RoomMenu';
import { PlayerSidebar } from './PlayerSidebar';

export const GameNavbar: React.FC = () => {
  const { gameState, playerName, getCurrentRound } = useGame();
  const [activeOverlay, setActiveOverlay] = useState<'room' | 'players' | null>(null);

  // Close room menu when joining a new game
  useEffect(() => {
    if (gameState) {
      setActiveOverlay(null);
    }
  }, [gameState?.gameId]);

  // Close overlays when round results appear
  useEffect(() => {
    const currentRound = getCurrentRound();
    if (currentRound?.phase === 'reveal') {
      setActiveOverlay(null);
    }
  }, [getCurrentRound()?.phase]);

  // Open player sidebar when lobby is open, close when game starts
  useEffect(() => {
    if (gameState?.meta?.status === 'waiting') {
      setActiveOverlay('players');
    } else if (gameState?.meta?.status === 'playing') {
      setActiveOverlay(null);
    }
  }, [gameState?.meta?.status]);

  if (!gameState) {
    return null;
  }

  return (
    <div className="game-header">
      <div className="header-main">
        <div className="game-status">
          {gameState.meta.status === 'playing' && getCurrentRound()
            ? `Round ${gameState.gameplay.rounds.length} - ${(() => {
                const phase = getCurrentRound()?.phase;
                return phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : 'Loading';
              })()}`
            : gameState.meta.status === 'waiting'
            ? 'Lobby Open'
            : gameState.meta.status
          }
        </div>
        <div 
          className="player-name"
          style={{ 
            cursor: 'pointer',
            maxWidth: '20vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          onClick={() => {
            setActiveOverlay(activeOverlay === 'players' ? null : 'players');
          }}
        >
          {playerName}
        </div>
        <div 
          className="game-id clickable" 
          onClick={() => {
            setActiveOverlay(activeOverlay === 'room' ? null : 'room');
          }}
        >
          {gameState.gameId}
        </div>
      </div>
      <RoomMenu 
        isVisible={activeOverlay === 'room'} 
        onClose={() => setActiveOverlay(null)} 
      />
      <PlayerSidebar 
        isOpen={activeOverlay === 'players'}
        onToggle={() => setActiveOverlay(activeOverlay === 'players' ? null : 'players')}
        onOpenAbout={() => {
          setActiveOverlay(null);
        }}
      />
    </div>
  );
};
