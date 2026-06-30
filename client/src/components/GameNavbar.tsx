import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { RoomMenu } from './RoomMenu';
import { PlayerSidebar } from './PlayerSidebar';

interface DailyChallengeInfo {
  challengeId: string;
  prompt: string;
}

interface UserSubmission {
  score: number;
  color: { h: number; s: number; l: number };
  averageColor: { h: number; s: number; l: number } | null;
}

interface GameNavbarProps {
  dailyChallengeMode?: boolean;
  onToggleHistory?: () => void;
  isLoading?: boolean;
  challengeDate?: string;
  dailyChallenge?: DailyChallengeInfo | null;
  dailySubmission?: UserSubmission | null;
  selectedColor?: { h: number; s: number; l: number };
}

export const GameNavbar: React.FC<GameNavbarProps> = ({ dailyChallengeMode, onToggleHistory, isLoading, challengeDate, dailyChallenge, dailySubmission, selectedColor }) => {
  const navigate = useNavigate();
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

  // Daily challenge mode
  if (dailyChallengeMode) {
    const dateString = challengeDate || new Date().toISOString().split('T')[0];

    return (
      <div className="game-header">
        <div className="header-main">
          <div
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          >
            🏠
          </div>
          <div className="game-status">{isLoading ? 'Loading...' : `Color of the Day - ${dateString}`}</div>
          <div
            onClick={onToggleHistory}
            style={{ cursor: onToggleHistory ? 'pointer' : 'default' }}
          >
            🗓️
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    // Don't render until we have challenge data — avoids a "Loading..." flash
    // and the grey swatch on first paint.
    if (!dailyChallenge) return null;

    const swatchStyle: React.CSSProperties = dailySubmission?.averageColor
      ? {
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: `hsl(${dailySubmission.color.h}, ${dailySubmission.color.s}%, ${dailySubmission.color.l}%)`,
          border: `2px solid hsl(${dailySubmission.averageColor.h}, ${dailySubmission.averageColor.s}%, ${dailySubmission.averageColor.l}%)`,
        }
      : {
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: selectedColor ? `hsl(${selectedColor.h}, ${selectedColor.s}%, ${selectedColor.l}%)` : '#ccc',
          border: 'none',
        };

    return (
      <div className="game-header"
        onClick={() => navigate('/daily')}
        style={{ cursor: 'pointer' }}
      >
        <div className="header-main" style={{ justifyContent: 'center', overflow: 'hidden', height: '32px', gap: '8px' }}>
          {dailySubmission ? (
            <>
              <div style={swatchStyle} />
              <span style={{ color: '#333', fontSize: '1rem', fontWeight: '600' }}>
                {dailySubmission.score} / 100 · See more →
              </span>
            </>
          ) : (
            <>
              <div style={swatchStyle} />
              <span style={{ color: '#667eea', fontSize: '1rem', fontWeight: '600', fontStyle: 'italic' }}>
                {dailyChallenge?.prompt || 'Loading...'}
              </span>
            </>
          )}
        </div>
      </div>
    );
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
