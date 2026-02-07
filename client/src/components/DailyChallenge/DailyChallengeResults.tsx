import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';
import { Button } from '../Button';
import { DailyChallengeLeaderboard } from './DailyChallengeLeaderboard';

export const DailyChallengeResults: React.FC = () => {
    const navigate = useNavigate();
    const { currentChallenge, userSubmission } = useDailyChallenge();
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    if (!currentChallenge || !userSubmission) return null;

    if (showLeaderboard) {
        return <DailyChallengeLeaderboard onBack={() => setShowLeaderboard(false)} />;
    }

    return (
        <>
            {/* Results in game results area */}
            <div className="game-summary-bar">
                <div className="result-card">
                    <div className="prompt-card">
                        <p className="prompt">"{currentChallenge.prompt}"</p>
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

                    <div className="colors-comparison">
                        <div className="color-block">
                            <h3>Your Color</h3>
                            <ColorBox color={userSubmission.color} width="150px" height="60px" />
                        </div>
                        {userSubmission.averageColor && (
                            <div className="color-block">
                                <h3>Average Color</h3>
                                <ColorBox color={userSubmission.averageColor} width="150px" height="60px" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions in game manager area */}
            <div className="game-controls">
                <Button onClick={() => setShowLeaderboard(true)} variant="primary" style={{ width: '100%' }}>
                    View Full Leaderboard
                </Button>
                <Button onClick={() => navigate('/')} variant="back" style={{ width: '100%', marginTop: '10px' }}>
                    Back to Home
                </Button>
            </div>
        </>
    );
};
