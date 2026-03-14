import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useColor } from '../contexts/ColorContext';
import { useTimer } from '../hooks/useTimer';

const PHASE_EMOJI: Record<string, string> = {
  describing: '✏️',
  guessing: '🎨',
  reveal: '🎯',
  endgame: '🏆',
};

export const MinimisedView: React.FC = () => {
  const { gameState, getCurrentRound, playerId } = useGame();
  const { selectedColor } = useColor();
  const currentRound = getCurrentRound();

  const activeDeadline = currentRound?.phase === 'describing'
    ? currentRound.timers?.descriptionDeadline
    : currentRound?.phase === 'guessing'
      ? currentRound.timers?.guessingDeadline
      : undefined;
  const activeTimeLimit = currentRound?.phase === 'describing'
    ? (gameState?.config.descriptionTimeLimit ?? 30)
    : (gameState?.config.guessingTimeLimit ?? 15);

  const timer = useTimer({ deadline: activeDeadline, timeLimit: activeTimeLimit, onTimeUp: () => {}, active: !!activeDeadline });

  const describer = gameState?.players.find(p => p.playerId === currentRound?.describerId);
  const isDescriber = currentRound?.describerId === playerId;
  const hasGuessed = playerId ? !!currentRound?.submissions[playerId] : false;

  const actionNeeded =
    (currentRound?.phase === 'describing' && isDescriber) ||
    (currentRound?.phase === 'guessing' && !isDescriber && !hasGuessed);
  const emoji = currentRound?.phase ? PHASE_EMOJI[currentRound.phase] : '⏳';

  let turnLabel
  switch(currentRound?.phase) {
    case 'reveal':
      turnLabel = `Round ${(gameState?.meta.currentRound ?? 0) + 1}`
      break;
    case 'guessing':
      turnLabel = (isDescriber || hasGuessed) ? "Players Guessing" : "YOUR TURN"
      break;
    case 'describing':
      turnLabel = (describer && !isDescriber) ? `${describer.playerName} describing` : "YOUR TURN"
      break;
    case 'endgame': {
      const sorted = [...(gameState?.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const rank = sorted.findIndex(p => p.playerId === playerId) + 1;
      turnLabel = rank > 0 ? `#${rank} of ${sorted.length}` : 'Final Score';
      break;
    }
    default:
      turnLabel = 'Waiting for Players'
  }

  const infoLine = turnLabel ? `${emoji} ${turnLabel}` : null;
  const waitingCount = !currentRound && gameState ? `${gameState.players.length}/${gameState.config.maxPlayers}` : null;
  const displayScore = currentRound?.phase === 'reveal' && playerId
    ? currentRound?.scores?.[playerId] ?? null
    : currentRound?.phase === 'endgame' && playerId
      ? gameState?.players.find(p => p.playerId === playerId)?.score ?? null
      : null;

  return (
    <div className={`minimised-view${actionNeeded ? ' minimised-action' : ''}`} style={{ backgroundColor: `hsl(${selectedColor.h}, ${selectedColor.s}%, ${selectedColor.l}%)` }}>
      {(infoLine) && <div className="minimised-info">{infoLine}</div>}
      {displayScore != null || waitingCount != null
        ? <div className="small-screen-timer">{displayScore ?? waitingCount}</div>
        : timer.isActive && <div className="small-screen-timer">{timer.countdown}</div>
      }
    </div>
  );
};
