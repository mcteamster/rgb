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
          <ColorBox color={userSubmission.color} width="200px" height="60px" />
        </div>

        {userSubmission.averageColor && (
          <div className="color-box-container">
            <h3>Average Color</h3>
            <ColorBox color={userSubmission.averageColor} width="200px" height="60px" />
          </div>
        )}
      </div>
    </div>
  );
};
