import React, { useEffect, useState, useMemo } from 'react';
import { dailyChallengeApi } from '../../services/dailyChallengeApi';
import { HistoryResponse, HistorySubmission } from '../../types/dailyChallenge';
import '../../styles/daily-challenge-calendar.css';

interface DailyChallengeHistoryProps {
  userId: string;
  onSelectDate: (date: string) => void;
}

function buildMonthGroups() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startUTC = new Date(todayUTC);
  startUTC.setUTCDate(startUTC.getUTCDate() - 29);

  const days = [];
  const current = new Date(startUTC);
  while (current <= todayUTC) {
    const date = current.toISOString().split('T')[0];
    days.push({
      date,
      dayOfMonth: current.getUTCDate(),
      dayOfWeek: current.getUTCDay(),
      month: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      monthYear: `${current.getUTCFullYear()}-${current.getUTCMonth()}`,
      isToday: date === todayUTC.toISOString().split('T')[0],
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const groups: Record<string, typeof days> = {};
  days.forEach(d => { (groups[d.month] ??= []).push(d); });

  return Object.keys(groups).map(month => {
    const monthDays = groups[month];
    const first = monthDays[0];
    const last = monthDays[monthDays.length - 1];
    const firstDow = first.dayOfWeek === 0 ? 6 : first.dayOfWeek - 1;
    const lastDow = last.dayOfWeek === 0 ? 6 : last.dayOfWeek - 1;
    const [year, monthNum] = last.monthYear.split('-').map(Number);
    const lastDayOfMonth = new Date(Date.UTC(year, monthNum + 1, 0)).getUTCDate();

    const padded: Array<{ type: string; dayOfMonth?: number; date?: string; isToday?: boolean }> = [];
    for (let i = 0; i < firstDow; i++) {
      const n = first.dayOfMonth - firstDow + i;
      padded.push(n > 0 ? { type: 'disabled', dayOfMonth: n } : { type: 'empty' });
    }
    padded.push(...monthDays.map(d => ({ type: 'active', ...d })));
    for (let i = lastDow + 1; i < 7; i++) {
      const n = last.dayOfMonth + (i - lastDow);
      padded.push(n <= lastDayOfMonth ? { type: 'disabled', dayOfMonth: n } : { type: 'empty' });
    }
    return { month, days: padded };
  });
}

export const DailyChallengeHistory: React.FC<DailyChallengeHistoryProps> = ({ userId, onSelectDate }) => {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const monthGroups = useMemo(() => buildMonthGroups(), []);

  useEffect(() => {
    setIsLoading(true);
    dailyChallengeApi.getUserHistory(userId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [userId]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const playedToday = useMemo(() => history?.submissions.some(s => s.challengeId === today), [history, today]);
  const streakDisplay = playedToday ? `${history!.stats.currentStreak} 🔥` : '⏳';
  const submissionMap = useMemo(() => new Map<string, HistorySubmission>(
    history?.submissions.map(s => [s.challengeId, s]) ?? []
  ), [history]);

  const scrollToDate = (challengeId: string) => {
    const element = document.getElementById(`history-item-${challengeId}`);
    const container = containerRef.current;
    if (element && container) {
      container.scrollTo({ top: element.offsetTop - container.offsetTop - 20, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return <div className="loading-message">Loading history...</div>;
  }

  return (
    <div className="history-container" ref={containerRef}>
      {history && history.submissions.length > 0 && (
        <>
          <h3 className="history-title">Last 30 Days</h3>
          <div className="history-stats">
            <div className="stat-item">
              <span className="stat-value">{streakDisplay}</span>
              <span className="stat-label">Streak</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{Math.round(history.stats.averageScore)}</span>
              <span className="stat-label">Average</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{history.stats.bestScore}</span>
              <span className="stat-label">Best</span>
            </div>
          </div>
        </>
      )}
      <div className="calendar-months">
        {monthGroups.map(({ month, days }) => (
          <div key={month} className="month-section">
            <div className="month-header">{month}</div>
            <div className="weekday-headers">
              {['M','T','W','T','F','S','S'].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="days-list">
              {days.map((day, index) => {
                if (day.type === 'active' && day.date) {
                  const submission = submissionMap.get(day.date);
                  return (
                    <button
                      key={day.date}
                      className={`day-button ${day.isToday ? 'today' : ''} ${submission ? 'completed' : ''}`}
                      onClick={() => submission ? scrollToDate(day.date!) : onSelectDate(day.date!)}
                      style={submission ? {
                        backgroundColor: `hsl(${submission.submittedColor.h}, ${submission.submittedColor.s}%, ${submission.submittedColor.l}%)`,
                        borderColor: `hsl(${submission.averageAtSubmission.h}, ${submission.averageAtSubmission.s}%, ${submission.averageAtSubmission.l}%)`,
                        color: submission.submittedColor.l > 50 ? '#333' : '#fff'
                      } : undefined}
                    >
                      {day.dayOfMonth}
                    </button>
                  );
                } else if (day.type === 'disabled') {
                  return <div key={`disabled-${index}`} className="day-disabled">{day.dayOfMonth}</div>;
                } else {
                  return <div key={`empty-${index}`} className="day-empty"></div>;
                }
              })}
            </div>
          </div>
        ))}
      </div>

      {history && history.submissions.length > 0 && (
        <div className="history-list">
          {history.submissions.map((submission) => (
            <div key={submission.challengeId} id={`history-item-${submission.challengeId}`} className="history-item" onClick={() => onSelectDate(submission.challengeId)} style={{ cursor: 'pointer' }}>
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
      )}
    </div>
  );
};
