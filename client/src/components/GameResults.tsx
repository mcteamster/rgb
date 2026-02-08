import React, { useEffect } from 'react';
import { Player } from '../types/game';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { ColorBox } from './ColorBox';
import { getOrdinalSuffix } from '../utils/formatUtils';

interface GameResultsProps {
  players?: Player[];
  rounds?: any[];
  dailyChallengeMode?: boolean;
  skipLoad?: boolean;
}

export const GameResults: React.FC<GameResultsProps> = ({ players, rounds, dailyChallengeMode = false, skipLoad = false }) => {
  const { currentChallenge, leaderboard, loadLeaderboard, isLoading } = useDailyChallenge();
  const loadedChallengeId = React.useRef<string | null>(null);

  useEffect(() => {
    if (!skipLoad && dailyChallengeMode && currentChallenge && loadedChallengeId.current !== currentChallenge.challengeId) {
      loadedChallengeId.current = currentChallenge.challengeId;
      loadLeaderboard(currentChallenge.challengeId);
    }
  }, [skipLoad, dailyChallengeMode, currentChallenge, loadLeaderboard]);

  // Daily challenge leaderboard
  if (dailyChallengeMode && currentChallenge) {
    return (
      <div className="game-summary-bar">
        <div className="leaderboard-container">
          <h2>Daily Challenge Leaderboard</h2>
          <div className="prompt-card">
            <p className="prompt">"{currentChallenge.prompt}"</p>
            <p className="submissions-count">
              Total submissions: {currentChallenge.totalSubmissions}
            </p>
          </div>

          {isLoading ? (
            <div className="loading-message">Loading leaderboard...</div>
          ) : (
            <div className="leaderboard-table">
              {leaderboard.length === 0 ? (
                <p className="no-submissions">No submissions yet. Be the first!</p>
              ) : (
                <div className="leaderboard-entries">
                  {leaderboard.map((entry) => (
                    <div key={`${entry.rank}-${entry.userName}`} className="leaderboard-row">
                      <span className="rank">#{entry.rank}</span>
                      <span className="name">{entry.userName || 'Anonymous'}</span>
                      <span className="score">{entry.score} pts</span>
                      <div className="color-preview">
                        <ColorBox
                          color={entry.submittedColor}
                          width="60px"
                          height="30px"
                          fontSize="8px"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiplayer game results
  if (!players || !rounds) return null;

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
                            className="describer-square color-accurate"
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
                            className="guess-square color-accurate"
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
                          className="guess-square color-accurate"
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
