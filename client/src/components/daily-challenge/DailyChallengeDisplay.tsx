import React from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';

export const DailyChallengeDisplay: React.FC = () => {
  const { currentChallenge } = useDailyChallenge();

  if (!currentChallenge) return null;

  const formatTimeRemaining = (validUntil: string, challengeId: string) => {
    const now = new Date();
    const end = new Date(validUntil);
    const diff = end.getTime() - now.getTime();

    // Today's challenge - show countdown to new challenge
    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `⏳ ${hours}h ${minutes}m until refresh`;
    }

    // Past challenge - calculate time until 30-day limit
    const challengeDate = new Date(challengeId);
    const thirtyDaysFromChallenge = new Date(challengeDate);
    thirtyDaysFromChallenge.setDate(challengeDate.getDate() + 30);
    
    const timeLeft = thirtyDaysFromChallenge.getTime() - now.getTime();
    
    if (timeLeft <= 0) {
      return 'Expired';
    }

    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    
    // 30 days ago (less than 1 day left) - show hours and minutes
    if (daysLeft < 1) {
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return `⏳ ${hoursLeft}h ${minutesLeft}m left to play`;
    }
    
    // Other days - show days left
    return `⏳ ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to play`;
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
