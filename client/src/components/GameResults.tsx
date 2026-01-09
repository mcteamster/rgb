import React from 'react';
import { Player } from '../types/game';
import { getOrdinalSuffix } from '../utils/formatUtils';

interface GameResultsProps {
  players: Player[];
  rounds: any[];
}

export const GameResults: React.FC<GameResultsProps> = ({ players, rounds }) => {
  // Sort players by score (highest first)
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Get all winners (players with the highest score)
  const highestScore = sortedPlayers[0]?.score || 0;
  const winners = sortedPlayers.filter(player => (player.score || 0) === highestScore);

  return (
    <div className="game-summary-bar">
      <div className="game-summary">
        <div className="podium-section">
          <div className="podium-content">
            <div className="trophy-emoji">
              🏆
            </div>
            {winners.map((winner) => (
              <div key={winner.playerId} className="winner-name">
                {winner.playerName}
              </div>
            ))}
            <div className="winner-points">
              {highestScore} points
            </div>
          </div>
        </div>

        <div className="standings-section">
          <div className="standings-list">
            {sortedPlayers.map((player, index) => {
              // Calculate proper ranking accounting for ties
              let rank = index + 1;
              for (let i = 0; i < index; i++) {
                if (sortedPlayers[i].score === player.score) {
                  rank = i + 1;
                  break;
                }
              }

              return (
                <div
                  key={player.playerId}
                  className={`standings-row ${index < 3 ? 'top-three' : 'other'}`}
                >
                  <div className="standings-info">
                    <span className={`standings-rank ${index < 3 ? 'bold' : ''}`}>
                      {rank}{getOrdinalSuffix(rank)}
                    </span>
                    <span className="standings-name">
                      {player.playerName}
                    </span>
                    <span className="standings-score">
                      {player.score || 0}
                    </span>
                  </div>
                  <div className="guess-history">
                    {rounds.map((round, roundIndex) => {
                      const isDescriber = round.describerId === player.playerId;
                      const playerGuess = round.submissions?.[player.playerId];
                      const targetColor = round.targetColor;

                      if (isDescriber) {
                        const hasDescription = round.description && round.description.trim().length > 0;
                        return (
                          <div
                            key={roundIndex}
                            className="describer-square"
                            style={{
                              backgroundColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`,
                              borderColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`,
                              color: targetColor.l > 50 ? '#000' : '#fff'
                            }}
                          >
                            {hasDescription ? '📣' : '❌'}
                          </div>
                        );
                      }

                      if (!targetColor) return null;

                      if (!playerGuess) {
                        // Skipped round - show target color with skip emoji
                        return (
                          <div
                            key={roundIndex}
                            className="guess-square"
                            style={{
                              backgroundColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`,
                              borderColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              color: targetColor.l > 50 ? '#000' : '#fff'
                            }}
                          >
                            ⏭️
                          </div>
                        );
                      }

                      return (
                        <div
                          key={roundIndex}
                          className="guess-square"
                          style={{
                            backgroundColor: `hsl(${playerGuess.h}, ${playerGuess.s}%, ${playerGuess.l}%)`,
                            borderColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
