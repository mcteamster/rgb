import React, { useEffect, useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { DailyChallengeSubmission } from './DailyChallengeSubmission';
import { DailyChallengeResults } from './DailyChallengeResults';
import { DailyChallengeLeaderboard } from './DailyChallengeLeaderboard';

export const DailyChallengeContainer: React.FC = () => {
    const { currentChallenge, userSubmission, loadCurrentChallenge, isLoading } = useDailyChallenge();
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    useEffect(() => {
        loadCurrentChallenge();
    }, []);

    if (isLoading) {
        return (
            <div className="daily-challenge-container">
                <div className="loading-message">Loading today's challenge...</div>
            </div>
        );
    }

    if (!currentChallenge) {
        return (
            <div className="daily-challenge-container">
                <div className="error-message">No challenge available today</div>
            </div>
        );
    }

    if (showLeaderboard) {
        return <DailyChallengeLeaderboard onBack={() => setShowLeaderboard(false)} />;
    }

    if (userSubmission) {
        return <DailyChallengeResults onViewLeaderboard={() => setShowLeaderboard(true)} />;
    }

    return <DailyChallengeSubmission />;
};
