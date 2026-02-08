import React, { useEffect, useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { dailyChallengeApi } from '../../services/dailyChallengeApi';
import { StatsResponse } from '../../types/dailyChallenge';

interface DailyChallengeResultsProps {
  skipLoad?: boolean;
}

export const DailyChallengeResults: React.FC<DailyChallengeResultsProps> = ({ skipLoad = false }) => {
  const { currentChallenge } = useDailyChallenge();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadedChallengeId = React.useRef<string | null>(null);

  useEffect(() => {
    if (!skipLoad && currentChallenge && loadedChallengeId.current !== currentChallenge.challengeId) {
      loadedChallengeId.current = currentChallenge.challengeId;
      setIsLoading(true);
      dailyChallengeApi.getStats(currentChallenge.challengeId)
        .then(setStats)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [skipLoad, currentChallenge]);

  if (!currentChallenge) return null;

  return (
    <div className="game-summary-bar">
      <div className="stats-container">
        <div className="prompt-card">
          <p className="prompt">"{currentChallenge.prompt}"</p>
          <p className="submissions-count">
            Total submissions: {currentChallenge.totalSubmissions}
          </p>
        </div>

        {isLoading ? (
          <div className="loading-message">Loading statistics...</div>
        ) : !stats || stats.totalSubmissions === 0 ? (
          <p className="no-submissions">No submissions yet. Be the first!</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-row">
                <h3>H</h3>
                <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.hue!.avg)}°</span></span>
                <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.hue!.stdDev)}°</span></span>
              </div>
              <div 
                className="hue-spectrum"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(${stats.hue!.avg - 90}, 100%, 50%), 
                    hsl(${stats.hue!.avg - 60}, 100%, 50%), 
                    hsl(${stats.hue!.avg - 30}, 100%, 50%), 
                    hsl(${stats.hue!.avg}, 100%, 50%), 
                    hsl(${stats.hue!.avg + 30}, 100%, 50%), 
                    hsl(${stats.hue!.avg + 60}, 100%, 50%), 
                    hsl(${stats.hue!.avg + 90}, 100%, 50%)
                  )`
                }}
              >
                <div 
                  className="hue-range"
                  style={{
                    left: `${((90 - stats.hue!.stdDev) / 180 * 100)}%`,
                    width: `${(stats.hue!.stdDev * 2 / 180 * 100)}%`
                  }}
                />
                <div className="hue-average" />
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-row">
                <h3>S</h3>
                <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.saturation!.avg)}%</span></span>
                <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.saturation!.stdDev)}%</span></span>
              </div>
              <div 
                className="hue-spectrum"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(${stats.hue!.avg}, 0%, 50%), 
                    hsl(${stats.hue!.avg}, 100%, 50%)
                  )`
                }}
              >
                <div 
                  className="hue-range"
                  style={{
                    left: `${Math.max(0, stats.saturation!.avg - stats.saturation!.stdDev)}%`,
                    width: `${Math.min(100, stats.saturation!.stdDev * 2)}%`
                  }}
                />
                <div 
                  className="hue-average"
                  style={{
                    left: `${stats.saturation!.avg}%`
                  }}
                />
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-row">
                <h3>L</h3>
                <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.lightness!.avg)}%</span></span>
                <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.lightness!.stdDev)}%</span></span>
              </div>
              <div 
                className="hue-spectrum"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(${stats.hue!.avg}, ${stats.saturation!.avg}%, 0%), 
                    hsl(${stats.hue!.avg}, ${stats.saturation!.avg}%, 50%),
                    hsl(${stats.hue!.avg}, ${stats.saturation!.avg}%, 100%)
                  )`
                }}
              >
                <div 
                  className="hue-range"
                  style={{
                    left: `${Math.max(0, stats.lightness!.avg - stats.lightness!.stdDev)}%`,
                    width: `${Math.min(100, stats.lightness!.stdDev * 2)}%`
                  }}
                />
                <div 
                  className="hue-average"
                  style={{
                    left: `${stats.lightness!.avg}%`
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
