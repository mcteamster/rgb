import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';

export const DailyChallengeReveal: React.FC = () => {
  const { currentChallenge, userSubmission } = useDailyChallenge();

  if (!currentChallenge || !userSubmission || !userSubmission.color) return null;

  return (
    <div className="round-reveal">
      <p className="prompt">"{currentChallenge.prompt}"</p>
      
      <div className="score-display">
        <h1 className="score">{userSubmission.score}</h1>
        <p className="score-label">points</p>
        {userSubmission.rank && (
          <p className="rank">
            Rank: #{userSubmission.rank} of {currentChallenge.totalSubmissions}
          </p>
        )}
        {userSubmission.distanceFromAverage !== undefined && (
          <p className="distance">
            Distance: {userSubmission.distanceFromAverage.toFixed(3)}
          </p>
        )}
      </div>

      <div className="color-comparison">
        <div className="color-box-container">
          <h3>Your Color</h3>
          <ColorBox color={userSubmission.color} size="large" />
          <div className="color-values">
            <div>H: {userSubmission.color.h}°</div>
            <div>S: {userSubmission.color.s}%</div>
            <div>L: {userSubmission.color.l}%</div>
          </div>
        </div>

        {userSubmission.averageColor && (
          <div className="color-box-container">
            <h3>Average Color</h3>
            <ColorBox color={userSubmission.averageColor} size="large" />
            <div className="color-values">
              <div>H: {Math.round(userSubmission.averageColor.h)}°</div>
              <div>S: {Math.round(userSubmission.averageColor.s)}%</div>
              <div>L: {Math.round(userSubmission.averageColor.l)}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
