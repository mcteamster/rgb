import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';

export const DailyChallengePrompt: React.FC = () => {
    const { currentChallenge } = useDailyChallenge();

    if (!currentChallenge) return null;

    const formatTimeRemaining = (validUntil: string) => {
        const now = new Date();
        const end = new Date(validUntil);
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m remaining`;
    };

    return (
        <div className="status-bar daily-challenge-status">
            <div className="prompt-card">
                <p className="prompt">"{currentChallenge.prompt}"</p>
                <p className="timer">{formatTimeRemaining(currentChallenge.validUntil)}</p>
                <p className="submissions-count">
                    {currentChallenge.totalSubmissions} {currentChallenge.totalSubmissions === 1 ? 'submission' : 'submissions'} so far
                </p>
            </div>
        </div>
    );
};
