import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ColorWheel } from './ColorWheel';
import { PlayerLobby } from './PlayerLobby';
import { GameManager } from './GameManager';
import { GameDisplay } from './GameDisplay';
import { GameNavbar } from './GameNavbar';
import { GameTitle } from './GameTitle';
import { ConnectionStatus } from './ConnectionStatus';
import { GameResults } from './GameResults';
import { RainbowIcon } from './RainbowIcon';
import { AboutPage } from './AboutPage';
import { ColorWheelTips } from './ColorGuessingTips';
import { useColor } from '../contexts/ColorContext';
import { useGame, loadSession, clearSession } from '../contexts/GameContext';
import { setBodyBackground } from '../utils/colorUtils';
import { discordSdk } from '../services/discord';
import { API_BASE_URL } from '../constants/regions';

export const GameContainer: React.FC = () => {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const navigate = useNavigate();
  const { selectedColor, setIsColorLocked } = useColor();
  const { gameState, playerId, rejoinGame, getCurrentRound } = useGame();
  const discordRoomChecked = useRef(false);
  const [showAbout, setShowAbout] = useState(false);
  const [size, setSize] = useState(() => {
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [hasSeenTipsThisGame, setHasSeenTipsThisGame] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Clear color lock when new round starts
  useEffect(() => {
    const currentRound = getCurrentRound();
    const currentRoundId = currentRound?.startedAt;
    if (currentRoundId && currentRoundId !== lastRoundId) {
      setIsColorLocked(false);
      setLastRoundId(currentRoundId);
    }
  }, [getCurrentRound, lastRoundId, setIsColorLocked]);

  // Show tips on first guessing phase of each game
  useEffect(() => {
    const currentRound = getCurrentRound();
    const isGuessing = currentRound?.phase === 'guessing';
    const isDescriber = currentRound?.describerId === playerId;
    
    if (!hasSeenTipsThisGame && isGuessing && !isDescriber && gameState) {
      setShowTips(true);
    }
  }, [hasSeenTipsThisGame, getCurrentRound, playerId, gameState]);

  const handleDismissTips = () => {
    setShowTips(false);
    setHasSeenTipsThisGame(true);
  };

  // Update body background to always match selected color
  useEffect(() => {
    setBodyBackground(selectedColor);
  }, [selectedColor]);

  // Check if URL room code matches saved session and attempt rejoin
  useEffect(() => {
    // Discord room sync - check if we need to redirect to existing room (only run once)
    if (!roomCode && discordSdk?.instanceId && !discordRoomChecked.current) {
      discordRoomChecked.current = true;
      (async () => {
        try {
          console.log('Discord auto-join: Attempting room sync for instance:', discordSdk.instanceId);
          const response = await fetch(`${API_BASE_URL}/common/rooms/${discordSdk.instanceId}`);
          console.log('Discord auto-join: API response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }
          
          const roomData = await response.json();
          console.log('Discord auto-join: Room data received:', roomData);
          
          if (roomData?.room?.match(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/i)) {
            console.log('Discord auto-join: Navigating to room:', roomData.room);
            navigate(`/${roomData.room}`, { replace: true });
            return;
          } else {
            console.log('Discord auto-join: No valid room found in response');
          }
        } catch (error) {
          console.error('Discord room sync failed:', error);
        }
      })();
    }

    if (roomCode) {
      if (/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(roomCode.toUpperCase())) {
        const savedSession = loadSession();
        if (savedSession && savedSession.gameId === roomCode) {
          rejoinGame(savedSession.gameId, savedSession.playerId, savedSession.playerName);
        } else if (savedSession) {
          clearSession();
          navigate(`/${roomCode.toUpperCase()}`, { replace: true });
        }
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [roomCode, navigate, rejoinGame]);

  // Show lobby modal over color wheel if not in a game
  if (!gameState || !playerId) {
    return (
      <div className="app-container">
        <RainbowIcon onShowAbout={() => setShowAbout(true)} />
        <ConnectionStatus />
        <GameNavbar />
        <GameTitle />
        <ColorWheel size={size} />
        <PlayerLobby roomCode={roomCode} />
        {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
      </div>
    );
  }

  // Show game interface
  const currentRound = getCurrentRound();
  const isEndgame = currentRound?.phase === 'endgame';

  return (
    <div className="app-container game-active">
      <RainbowIcon onShowAbout={() => setShowAbout(true)} />
      <ConnectionStatus />
      <GameNavbar />

      { isEndgame && <GameResults players={gameState.players} rounds={gameState.gameplay.rounds} />}
      <GameDisplay />
      <ColorWheel size={size} />

      <GameManager onShowAbout={() => setShowAbout(true)} />
      {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
      {showTips && <ColorWheelTips onDismiss={handleDismissTips} />}
    </div>
  );
};
