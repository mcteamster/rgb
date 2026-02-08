import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';

export const DailyChallengeReveal: React.FC = () => {
  const { currentChallenge, userSubmission } = useDailyChallenge();

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
      </div>
    </div>
  );
};
