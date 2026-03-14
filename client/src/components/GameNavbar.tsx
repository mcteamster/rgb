import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { RoomMenu } from './RoomMenu';
import { PlayerSidebar } from './PlayerSidebar';
import { CyclingText } from './CyclingText';
import { useCyclingText } from '../hooks/useCyclingText';
import { getUserName } from '../utils/userId';

interface GameNavbarProps {
  dailyChallengeMode?: boolean;
  onToggleHistory?: () => void;
  onShowCalendar?: () => void;
  isLoading?: boolean;
  challengeDate?: string;
}

export const GameNavbar: React.FC<GameNavbarProps> = ({ dailyChallengeMode, onToggleHistory, onShowCalendar, isLoading, challengeDate }) => {
  const navigate = useNavigate();
  const { gameState, playerName, getCurrentRound } = useGame();
  const [activeOverlay, setActiveOverlay] = useState<'room' | 'players' | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<{ prompt: string; validUntil: string } | null>(null);

  // Fetch daily challenge prompt when no game is active
  useEffect(() => {
    if (!gameState) {
      const baseUrl = import.meta.env.VITE_DAILY_CHALLENGE_API_URL || '';
      fetch(`${baseUrl}/daily-challenge/current?userId=preview`)
        .then(res => res.json())
        .then(data => setDailyChallenge({ prompt: data.prompt, validUntil: data.validUntil }))
        .catch(() => setDailyChallenge(null));
    }
  }, [gameState]);

  const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeLeft = dailyChallenge ? (() => {
    const diff = Math.max(0, new Date(dailyChallenge.validUntil).getTime() - Date.now());
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    return `${h}h ${m}m`;
  })() : null;
  const texts = [
    `🗓️ Daily Challenge - ${shortDate}`,
    `"${dailyChallenge?.prompt || 'Loading...'}"`,
    timeLeft ? `${timeLeft} ⏳ Tap to Play` : 'Tap to Play Now!'
  ];

  const { displayIndex, exiting } = useCyclingText(texts, 3000, !gameState && !!dailyChallenge);

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
    const userName = getUserName() || '👤';

    return (
      <div className="game-header">
        <div className="header-main">
          <div
            className="player-name"
            onClick={onToggleHistory}
            style={{ cursor: onToggleHistory ? 'pointer' : 'default' }}
          >
            {userName}
          </div>
          <div className="game-status">{isLoading ? 'Loading...' : 'Daily Challenge'}</div>
          <div
            className="room-code"
            onClick={onShowCalendar}
            style={{ cursor: onShowCalendar ? 'pointer' : 'default' }}
          >
            {dateString}
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="game-header"
        onClick={() => navigate('/daily')}
        style={{ cursor: 'pointer' }}
      >
        <div className="header-main" style={{ justifyContent: 'center', overflow: 'hidden', height: '32px' }}>
          <CyclingText
            text={texts[displayIndex]}
            exiting={exiting}
            style={{ color: displayIndex === 1 ? '#667eea' : '#333', fontStyle: displayIndex === 1 ? 'italic' : 'normal', fontSize: '1rem', fontWeight: '600' }}
          />
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
