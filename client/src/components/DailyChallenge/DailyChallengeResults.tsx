import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';
import { Button } from '../Button';

interface DailyChallengeResultsProps {
    onViewLeaderboard: () => void;
}

export const DailyChallengeResults: React.FC<DailyChallengeResultsProps> = ({ onViewLeaderboard }) => {
    const { currentChallenge, userSubmission } = useDailyChallenge();

    if (!currentChallenge || !userSubmission) return null;

    return (
        <div className="daily-challenge-results">
            <h2>Challenge Submitted!</h2>
            <div className="prompt-card">
                <p className="prompt">"{currentChallenge.prompt}"</p>
            </div>

            <div className="result-card">
                <div className="colors-comparison">
                    <div className="color-block">
                        <h3>Your Color</h3>
                        <ColorBox color={userSubmission.color} width="180px" height="80px" />
                    </div>
                    {userSubmission.averageColor && (
                        <div className="color-block">
                            <h3>Average Color</h3>
                            <ColorBox color={userSubmission.averageColor} width="180px" height="80px" />
                        </div>
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

            <div className="results-actions">
                <Button onClick={onViewLeaderboard} variant="primary">
                    View Full Leaderboard
                </Button>
                <Button onClick={() => window.location.href = '/'} variant="back">
                    Back to Home
                </Button>
            </div>
        </div>
    );
};
