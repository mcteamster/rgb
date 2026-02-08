import React, { useEffect } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';

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

  const calculateStats = () => {
    if (leaderboard.length === 0) return null;

    const hues = leaderboard.map(e => e.submittedColor.h);
    const sats = leaderboard.map(e => e.submittedColor.s);
    const lights = leaderboard.map(e => e.submittedColor.l);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdDev = (arr: number[]) => {
      const mean = avg(arr);
      const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    return {
      hue: { avg: avg(hues), stdDev: stdDev(hues), min: Math.min(...hues), max: Math.max(...hues) },
      sat: { avg: avg(sats), stdDev: stdDev(sats), min: Math.min(...sats), max: Math.max(...sats) },
      light: { avg: avg(lights), stdDev: stdDev(lights), min: Math.min(...lights), max: Math.max(...lights) }
    };
  };

  const stats = calculateStats();

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
        ) : !stats ? (
          <p className="no-submissions">No submissions yet. Be the first!</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Hue</h3>
              <div className="stat-row">
                <span className="stat-label">Average:</span>
                <span className="stat-value">{Math.round(stats.hue.avg)}°</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Std Dev:</span>
                <span className="stat-value">{Math.round(stats.hue.stdDev)}°</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Range:</span>
                <span className="stat-value">{Math.round(stats.hue.min)}° - {Math.round(stats.hue.max)}°</span>
              </div>
            </div>

            <div className="stat-card">
              <h3>Saturation</h3>
              <div className="stat-row">
                <span className="stat-label">Average:</span>
                <span className="stat-value">{Math.round(stats.sat.avg)}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Std Dev:</span>
                <span className="stat-value">{Math.round(stats.sat.stdDev)}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Range:</span>
                <span className="stat-value">{Math.round(stats.sat.min)}% - {Math.round(stats.sat.max)}%</span>
              </div>
            </div>

            <div className="stat-card">
              <h3>Lightness</h3>
              <div className="stat-row">
                <span className="stat-label">Average:</span>
                <span className="stat-value">{Math.round(stats.light.avg)}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Std Dev:</span>
                <span className="stat-value">{Math.round(stats.light.stdDev)}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Range:</span>
                <span className="stat-value">{Math.round(stats.light.min)}% - {Math.round(stats.light.max)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
