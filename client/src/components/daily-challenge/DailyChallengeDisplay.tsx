import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';

export const DailyChallengeDisplay: React.FC = () => {
  const { currentChallenge } = useDailyChallenge();

  if (!currentChallenge) return null;

  const formatTimeRemaining = (validUntil: string, challengeId: string) => {
    const now = new Date();
    const end = new Date(validUntil);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      // Calculate days until 30-day limit
      const challengeDate = new Date(challengeId);
      const thirtyDaysFromChallenge = new Date(challengeDate);
      thirtyDaysFromChallenge.setDate(challengeDate.getDate() + 30);
      
      const daysLeft = Math.ceil((thirtyDaysFromChallenge.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft > 0) {
        return `⏳ ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to play`;
      }
      return 'Expired';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `⏳ ${hours}h ${minutes}m left`;
  };

  return (
    <div className="status-bar daily-challenge-status">
      <div className="prompt-card">
        <p className="prompt">"{currentChallenge.prompt}"</p>
        <p className="submissions-count">
          🎨 {currentChallenge.totalSubmissions} {currentChallenge.totalSubmissions === 1 ? 'player' : 'players'}
        </p>
        <p className="timer">{formatTimeRemaining(currentChallenge.validUntil, currentChallenge.challengeId)}</p>
      </div>
    </div>
  );
};
