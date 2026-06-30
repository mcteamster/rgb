import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { RoomMenu } from './RoomMenu';
import { PlayerSidebar } from './PlayerSidebar';
import { API_BASE_URL } from '../constants/regions';

interface GameNavbarProps {
  dailyChallengeMode?: boolean;
  onToggleHistory?: () => void;
  isLoading?: boolean;
  challengeDate?: string;
}

export const GameNavbar: React.FC<GameNavbarProps> = ({ dailyChallengeMode, onToggleHistory, isLoading, challengeDate }) => {
  const navigate = useNavigate();
  const { gameState, playerName, getCurrentRound, currentRegion } = useGame();
  const [activeOverlay, setActiveOverlay] = useState<'room' | 'players' | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  // Fetch notice for the home screen banner
  useEffect(() => {
    if (gameState) return;
    fetch(`${API_BASE_URL}/common/notices/rgb`)
      .then(r => r.json())
      .then(data => {
        const msg = data?.messages?.[currentRegion] ?? data?.messages?.ALL ?? null;
        setNoticeText(msg || null);
      })
      .catch(() => setNoticeText(null));
  }, [gameState, currentRegion]);

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
    if (!noticeText) return null;

    return (
      <div className="game-header">
        <div className="header-main" style={{ justifyContent: 'center', overflow: 'hidden', height: '32px', gap: '8px' }}>
          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {noticeText}
          </span>
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
