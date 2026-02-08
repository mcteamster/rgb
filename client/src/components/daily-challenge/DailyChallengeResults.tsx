import React, { useEffect } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';

interface DailyChallengeResultsProps {
  skipLoad?: boolean;
}

export const DailyChallengeResults: React.FC<DailyChallengeResultsProps> = ({ skipLoad = false }) => {
  const { currentChallenge, leaderboard, loadLeaderboard, isLoading } = useDailyChallenge();
  const loadedChallengeId = React.useRef<string | null>(null);

  useEffect(() => {
    if (!skipLoad && currentChallenge && loadedChallengeId.current !== currentChallenge.challengeId) {
      loadedChallengeId.current = currentChallenge.challengeId;
      loadLeaderboard(currentChallenge.challengeId);
    }
  }, [skipLoad, currentChallenge, loadLeaderboard]);

  if (!currentChallenge) return null;

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
                      <ColorBox color={entry.submittedColor} size="small" />
                      <div className="color-values-compact">
                        <span>H: {entry.submittedColor.h}°</span>
                        <span>S: {entry.submittedColor.s}%</span>
                        <span>L: {entry.submittedColor.l}%</span>
                      </div>
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
};
