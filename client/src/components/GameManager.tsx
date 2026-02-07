import React, { useState, useEffect } from 'react';
import { useColor } from '../contexts/ColorContext';
import { useGame } from '../contexts/GameContext';
import { Button } from './Button';
import { PlayerDescriber } from './PlayerDescriber';
import { PlayerGuesser } from './PlayerGuesser';
import { useIsHost } from '../hooks/useIsHost';

interface GameManagerProps {
  onShowAbout: () => void;
  onShowTips?: () => void;
  dailyChallengeMode?: boolean;
  dailyChallengeSubmission?: React.ReactNode;
}

export const GameManager: React.FC<GameManagerProps> = ({ onShowAbout, onShowTips, dailyChallengeMode, dailyChallengeSubmission }) => {
  const { selectedColor, isColorLocked, setIsColorLocked, showSliders, setShowSliders, setSelectedColor, setSelectedHue } = useColor();
  const { gameState, startRound, playerId, submitDescription, updateDraftDescription, submitColor, getCurrentRound, finaliseGame, resetGame, closeRoom } = useGame();
  const [description, setDescription] = useState('');
  const [inputDisabled, setInputDisabled] = useState(false);
  const [nextRoundDisabled, setNextRoundDisabled] = useState(false);

  const currentRound = getCurrentRound();
  const isDescriber = currentRound?.describerId === playerId;
  const isDescribing = currentRound?.phase === 'describing';
  const isGuessing = currentRound?.phase === 'guessing';
  const isReveal = currentRound?.phase === 'reveal';
  const isEndgame = currentRound?.phase === 'endgame';

  // Disable Next Round button for 3 seconds when reveal phase starts
  useEffect(() => {
    if (isReveal) {
      setNextRoundDisabled(true);
      const timer = setTimeout(() => {
        setNextRoundDisabled(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isReveal]);

  // Set target color as selected color when user is describer
  useEffect(() => {
    if (isDescriber && currentRound?.targetColor) {
      const targetColor = {
        h: currentRound.targetColor.h,
        s: currentRound.targetColor.s,
        l: currentRound.targetColor.l
      };
      setSelectedColor(targetColor);
      setSelectedHue(targetColor.h);
      setIsColorLocked(true);
    }
  }, [currentRound?.targetColor, currentRound?.describerId, playerId, setSelectedColor, setSelectedHue, setIsColorLocked]);

  // Handle input disabled state
  useEffect(() => {
    if (isDescribing && isDescriber) {
      setInputDisabled(false);
    }
  }, [isDescribing, isDescriber]);

  const isReadyForEndgame = () => {
    if (!gameState) return false;

    const turnsPerPlayer = gameState.config.turnsPerPlayer || 2;
    const players = gameState.players;
    const rounds = gameState.gameplay.rounds || [];

    // Count how many times each player has been a describer
    const describerCounts: Record<string, number> = {};
    players.forEach(player => {
      describerCounts[player.playerId] = 0;
    });

    rounds.forEach(round => {
      if (round.describerId && describerCounts[round.describerId] !== undefined) {
        describerCounts[round.describerId]++;
      }
    });

    // Check if all players have given at least turnsPerPlayer clues
    return players.every(player =>
      describerCounts[player.playerId] >= turnsPerPlayer
    );
  };

  const handleReplay = () => {
    resetGame();
    setIsColorLocked(false);
  };

  const handleNextRound = () => {
    if (isReadyForEndgame()) {
      // Transition to endgame instead of starting new round
      finaliseGame();
    } else {
      startRound();
    }
  };

  const handleSubmitDescription = () => {
    if (!description.trim()) return;
    submitDescription(description.trim());
    setDescription('');
  };

  // Handle daily challenge mode separately
  if (dailyChallengeMode) {
    return (
      <div className="game-controls">
        {dailyChallengeSubmission}
      </div>
    );
  }

  if (!gameState || !playerId) return null;

  // Find the host (player who joined earliest)
  const isHost = useIsHost();

  const canStartRound = gameState.meta.status === 'waiting' && gameState.players.length >= 2 && isHost;
  const isWaiting = gameState.meta.status === 'waiting';
  const hasContent = (isDescribing && isDescriber) || (isGuessing && !isDescriber) || isReveal || (isEndgame && isHost) || canStartRound || isWaiting;

  if (!hasContent) return null;

  return (
    <div className="game-controls">
      {currentRound ? (
        <div className="round-controls">
          {isDescribing && isDescriber && (
            <PlayerDescriber
              description={description}
              setDescription={setDescription}
              onSubmit={handleSubmitDescription}
              targetColor={currentRound.targetColor}
              deadline={currentRound.timers?.descriptionDeadline}
              timeLimit={gameState.config.descriptionTimeLimit}
              updateDraftDescription={updateDraftDescription}
              inputDisabled={inputDisabled}
            />
          )}

          {isGuessing && !isDescriber && (
            <PlayerGuesser
              selectedColor={selectedColor}
              isColorLocked={isColorLocked}
              setIsColorLocked={setIsColorLocked}
              showSliders={showSliders}
              setShowSliders={setShowSliders}
              submitColor={submitColor}
              deadline={currentRound.timers?.guessingDeadline}
              timeLimit={gameState.config.guessingTimeLimit}
              onShowTips={onShowTips}
            />
          )}

          {isReveal && (
            <Button 
              onClick={handleNextRound} 
              style={{ width: '100%' }}
              variant={nextRoundDisabled ? 'disabled' : 'primary'}
              disabled={nextRoundDisabled}
            >
              {isReadyForEndgame() ? 'Game Summary' : 'Next Round'}
            </Button>
          )}

          {isEndgame && isHost && (
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <Button
                onClick={handleReplay}
              >
                Replay
              </Button>
              <Button
                onClick={closeRoom}
                variant="exit"
              >
                End Game
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="lobby-controls">
          {canStartRound && <Button onClick={startRound} style={{ width: '100%' }}>Start Game</Button>}
          <Button onClick={onShowAbout} variant="primary" style={{ width: '100%', marginTop: canStartRound ? '10px' : '0' }}>
            How to Play?
          </Button>
        </div>
      )}
    </div>
  );
};
