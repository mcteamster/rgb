import React, { useEffect, useState } from 'react';
import { dailyChallengeApi } from '../../services/dailyChallengeApi';
import { HistoryResponse } from '../../types/dailyChallenge';

interface DailyChallengeHistoryProps {
  userId: string;
}

export const DailyChallengeHistory: React.FC<DailyChallengeHistoryProps> = ({ userId }) => {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    dailyChallengeApi.getUserHistory(userId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [userId]);

  const scrollToDate = (challengeId: string) => {
    const element = document.getElementById(`history-item-${challengeId}`);
    const container = containerRef.current;
    if (element && container) {
      const elementTop = element.offsetTop;
      const containerTop = container.offsetTop;
      container.scrollTo({ top: elementTop - containerTop - 20, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return <div className="loading-message">Loading history...</div>;
  }

  if (!history || history.submissions.length === 0) {
    return <p className="no-submissions">No submission history yet.</p>;
  }

  return (
    <div className="history-container" ref={containerRef}>
      <h3 className="history-title">Last 30 Days</h3>
      <div className="history-stats">
        <div className="stat-item">
          <span className="stat-value">{history.stats.totalPlayed}</span>
          <span className="stat-label">Days</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{history.stats.currentStreak}</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{Math.round(history.stats.averageScore)}</span>
          <span className="stat-label">Avg</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{history.stats.bestScore}</span>
          <span className="stat-label">Best</span>
        </div>
      </div>

      <div className="history-calendar">
        {Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayOfMonth = date.getDate();
          const submission = history.submissions.find(s => s.challengeId === dateStr);
          
          return (
            <div 
              key={dateStr} 
              className="calendar-day"
              title={submission ? `${dateStr}: ${submission.score} pts` : dateStr}
              onClick={() => submission && scrollToDate(dateStr)}
              style={{ cursor: submission ? 'pointer' : 'default' }}
            >
              {submission ? (
                <div 
                  className="calendar-day-color"
                  style={{ 
                    backgroundColor: `hsl(${submission.submittedColor.h}, ${submission.submittedColor.s}%, ${submission.submittedColor.l}%)`,
                    border: `4px solid hsl(${submission.averageAtSubmission.h}, ${submission.averageAtSubmission.s}%, ${submission.averageAtSubmission.l}%)`
                  }}
                >
                  <span className="calendar-day-label">{dayOfMonth}</span>
                </div>
              ) : (
                <div className="calendar-day-empty">
                  <span className="calendar-day-label">{dayOfMonth}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="history-list">
        {history.submissions.map((submission) => (
          <div key={submission.challengeId} id={`history-item-${submission.challengeId}`} className="history-item">
            <div className="history-text">
              <div className="history-date">{submission.challengeId}</div>
              <div className="history-prompt">"{submission.prompt}"</div>
            </div>
            <div className="history-colors">
              <div 
                className="history-color-box"
                style={{ 
                  backgroundColor: `hsl(${submission.submittedColor.h}, ${submission.submittedColor.s}%, ${submission.submittedColor.l}%)`,
                  border: `8px solid hsl(${submission.averageAtSubmission.h}, ${submission.averageAtSubmission.s}%, ${submission.averageAtSubmission.l}%)`
                }}
              >
                <div className="history-color-score">{submission.score}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
