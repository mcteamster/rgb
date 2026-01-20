import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useTimer } from '../hooks/useTimer';
import { RoundReveal } from './RoundReveal';

export const GameDisplay: React.FC = () => {
  const { gameState, playerId, getCurrentRound } = useGame();

  if (!gameState || !playerId) return null;

  const currentRound = getCurrentRound();
  const isDescriber = currentRound?.describerId === playerId;
  const isGuessingPhase = currentRound?.phase === 'guessing';
  const isDescribingPhase = currentRound?.phase === 'describing';

  // Timer for describer during guessing phase
  const guessingTimer = useTimer({
    deadline: currentRound?.timers?.guessingDeadline,
    timeLimit: gameState?.config?.guessingTimeLimit || 0,
    onTimeUp: () => {},
    active: isDescriber && isGuessingPhase
  });

  // Timer for guessers during describing phase
  const describingTimer = useTimer({
    deadline: currentRound?.timers?.descriptionDeadline,
    timeLimit: gameState?.config?.descriptionTimeLimit || 0,
    onTimeUp: () => {},
    active: !isDescriber && isDescribingPhase
  });

  // Show waiting for players when game is in waiting status
  if (gameState.meta.status === 'waiting') {
    return (
      <div className="status-bar">
        <div className="waiting-phase">
          <h3>Waiting for Players</h3>
          <p>Need at least 2 players to start</p>
          <div className="player-count">
            {gameState.players.length}/{gameState.config.maxPlayers} players
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentRound?.phase === 'describing' && !isDescriber && (
        <div className="status-bar">
          <div className="waiting-phase">
            <h3>Waiting for {gameState.players.find(p => p.playerId === currentRound.describerId)?.playerName || 'Player'}{describingTimer.countdown > 0 ? ` (${describingTimer.countdown}s)` : ''}</h3>
            <p>to come up with a clue</p>
          </div>
        </div>
      )}

      {currentRound?.phase === 'guessing' && isDescriber && (
        <div className="status-bar">
          <div className="waiting-phase">
            <p>Players are guessing{guessingTimer.countdown > 0 ? ` (${guessingTimer.countdown}s)` : ''}</p>
            <h3>"{currentRound.description}"</h3>
            <div className="submissions-count">
              {Object.keys(currentRound.submissions || {}).length}/{gameState.players.length - 1} Locked In
            </div>
          </div>
        </div>
      )}

      {currentRound?.phase === 'guessing' && !isDescriber && (
        <div className="status-bar">
          <div className="guessing-phase">
            <p>{gameState.players.find(p => p.playerId === currentRound.describerId)?.playerName || 'Player'} said</p>
            <h3>"{currentRound.description}"</h3>
            <div className="submissions-count">
              {Object.keys(currentRound.submissions || {}).length}/{gameState.players.length - 1} 🔒
            </div>
          </div>
        </div>
      )}

      {currentRound?.phase === 'reveal' && (
        <div className="status-bar">
          <RoundReveal
            currentRound={currentRound}
            players={gameState.players}
          />
        </div>
      )}
    </>
  );
};
