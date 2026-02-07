import React, { useEffect } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { ColorBox } from '../ColorBox';
import { Button } from '../Button';

interface DailyChallengeLeaderboardProps {
    onBack: () => void;
}

export const DailyChallengeLeaderboard: React.FC<DailyChallengeLeaderboardProps> = ({ onBack }) => {
    const { currentChallenge, leaderboard, loadLeaderboard, isLoading } = useDailyChallenge();

    useEffect(() => {
        if (currentChallenge) {
            loadLeaderboard(currentChallenge.challengeId);
        }
    }, [currentChallenge]);

    if (!currentChallenge) return null;

    return (
        <>
            {/* Leaderboard in status bar area */}
            <div className="status-bar daily-challenge-status">
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

            {/* Actions in GameManager area */}
            <div className="daily-challenge-form">
                <Button onClick={onBack} variant="back">
                    Back to Results
                </Button>
            </div>
        </>
    );
};
