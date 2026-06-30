import React, { useEffect, useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';
import { dailyChallengeApi } from '../../services/dailyChallengeApi';
import { getUserId } from '../../utils/userId';
import { StatsResponse } from '../../types/dailyChallenge';

export const DailyChallengeReveal: React.FC = () => {
  const { currentChallenge, userSubmission } = useDailyChallenge();
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    if (!currentChallenge) return;
    const controller = new AbortController();
    dailyChallengeApi.getStats(currentChallenge.challengeId, getUserId())
      .then(data => {
        if (!controller.signal.aborted) setStats(data);
      })
      .catch(err => {
        if (!controller.signal.aborted) console.error(err);
      });
    return () => controller.abort();
  }, [currentChallenge?.challengeId]);

  if (!currentChallenge || !userSubmission || !userSubmission.color) return null;

  return (
    <div className="round-reveal">
      <p className="prompt">"{currentChallenge.prompt}"</p>
      <div style={{ width: '100%', height: '2px', backgroundColor: '#ccc', margin: '1em 0' }}></div>      
      <div className="reveal-content">
        <div className="color-comparison">
          <ColorBox color={userSubmission.color} label="Your Color" width="180px" />

          {userSubmission.averageColor && (
            <ColorBox color={userSubmission.averageColor} label="Average Color" width="180px" />
          )}
        </div>

        <div className="score-display">
          <h1 className="score">{userSubmission.score}</h1>
          <p className="score-label">points</p>
          {userSubmission.distanceFromAverage !== undefined && (
            <p className="distance">
              Distance: {userSubmission.distanceFromAverage.toFixed(3)}
            </p>
          )}
        </div>
      </div>

      {stats && stats.totalSubmissions > 0 && (
        <>
          <div style={{ width: '100%', height: '2px', backgroundColor: '#ccc', margin: '1em 0' }}></div>
          <p className="submissions-count">Total submissions: {stats.totalSubmissions}</p>
          <div className="stats-grid">
            {stats.hue && (
              <div className="stat-card">
                <div className="stat-row">
                  <h3>H</h3>
                  <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.hue.avg)}°</span></span>
                  <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.hue.stdDev)}°</span></span>
                </div>
                <div className="hue-spectrum" style={{ background: `linear-gradient(to right, hsl(${stats.hue.avg - 90}, 100%, 50%), hsl(${stats.hue.avg - 60}, 100%, 50%), hsl(${stats.hue.avg - 30}, 100%, 50%), hsl(${stats.hue.avg}, 100%, 50%), hsl(${stats.hue.avg + 30}, 100%, 50%), hsl(${stats.hue.avg + 60}, 100%, 50%), hsl(${stats.hue.avg + 90}, 100%, 50%))` }}>
                  <div className="hue-range" style={{ left: `${((90 - stats.hue.stdDev) / 180 * 100)}%`, width: `${(stats.hue.stdDev * 2 / 180 * 100)}%` }} />
                  <div className="hue-average" />
                </div>
              </div>
            )}
            {stats.saturation && stats.hue && (
              <div className="stat-card">
                <div className="stat-row">
                  <h3>S</h3>
                  <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.saturation.avg)}%</span></span>
                  <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.saturation.stdDev)}%</span></span>
                </div>
                <div className="hue-spectrum" style={{ background: `linear-gradient(to right, hsl(${stats.hue.avg}, 0%, 50%), hsl(${stats.hue.avg}, 100%, 50%))` }}>
                  <div className="hue-range" style={{ left: `${Math.max(0, stats.saturation.avg - stats.saturation.stdDev)}%`, width: `${Math.min(100, stats.saturation.stdDev * 2)}%` }} />
                  <div className="hue-average" style={{ left: `${stats.saturation.avg}%` }} />
                </div>
              </div>
            )}
            {stats.lightness && stats.hue && stats.saturation && (
              <div className="stat-card">
                <div className="stat-row">
                  <h3>L</h3>
                  <span className="stat-label">μ: <span className="stat-value">{Math.round(stats.lightness.avg)}%</span></span>
                  <span className="stat-label">σ: <span className="stat-value">{Math.round(stats.lightness.stdDev)}%</span></span>
                </div>
                <div className="hue-spectrum" style={{ background: `linear-gradient(to right, hsl(${stats.hue.avg}, ${stats.saturation.avg}%, 0%), hsl(${stats.hue.avg}, ${stats.saturation.avg}%, 50%), hsl(${stats.hue.avg}, ${stats.saturation.avg}%, 100%))` }}>
                  <div className="hue-range" style={{ left: `${Math.max(0, stats.lightness.avg - stats.lightness.stdDev)}%`, width: `${Math.min(100, stats.lightness.stdDev * 2)}%` }} />
                  <div className="hue-average" style={{ left: `${stats.lightness.avg}%` }} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
