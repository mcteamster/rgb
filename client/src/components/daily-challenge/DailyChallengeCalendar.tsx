import React, { useEffect, useState } from 'react';
import '../../styles/daily-challenge-calendar.css';

interface DailyChallengeCalendarProps {
  onClose: () => void;
  onSelectDate: (date: string) => void;
  completedDates: Set<string>;
}

export const DailyChallengeCalendar: React.FC<DailyChallengeCalendarProps> = ({
  onClose,
  onSelectDate,
  completedDates
}) => {
  const [monthGroups, setMonthGroups] = useState<Array<{ month: string; days: Array<any> }>>([]);

  useEffect(() => {
    const today = new Date();
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const thirtyDaysAgo = new Date(todayUTC);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
    
    const days = [];
    const currentDate = new Date(thirtyDaysAgo);
    
    // Collect all available days
    while (currentDate <= new Date(todayUTC)) {
      const dateString = currentDate.toISOString().split('T')[0];
      const isToday = dateString === new Date(todayUTC).toISOString().split('T')[0];
      
      days.push({
        date: dateString,
        dayOfMonth: currentDate.getUTCDate(),
        dayOfWeek: currentDate.getUTCDay(),
        month: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        monthYear: `${currentDate.getUTCFullYear()}-${currentDate.getUTCMonth()}`,
        isToday
      });
      
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    // Group by month
    const groups: { [key: string]: Array<{ date: string; dayOfMonth: number; dayOfWeek: number; monthYear: string; isToday: boolean }> } = {};
    days.forEach(day => {
      if (!groups[day.month]) {
        groups[day.month] = [];
      }
      groups[day.month].push({ date: day.date, dayOfMonth: day.dayOfMonth, dayOfWeek: day.dayOfWeek, monthYear: day.monthYear, isToday: day.isToday });
    });
    
    // Convert to array and add padding
    const monthArray = Object.keys(groups).map(month => {
      const monthDays = groups[month];
      const firstAvailableDay = monthDays[0];
      const lastAvailableDay = monthDays[monthDays.length - 1];
      
      // Get day of week for first available day (0=Sun, convert to Mon=0)
      const firstDayOfWeek = firstAvailableDay.dayOfWeek === 0 ? 6 : firstAvailableDay.dayOfWeek - 1;
      
      // Get day of week for last available day
      const lastDayOfWeek = lastAvailableDay.dayOfWeek === 0 ? 6 : lastAvailableDay.dayOfWeek - 1;
      
      const paddedDays = [];
      
      // Add disabled days before first available day (same month)
      for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = firstAvailableDay.dayOfMonth - firstDayOfWeek + i;
        if (dayNum > 0) {
          paddedDays.push({ type: 'disabled', dayOfMonth: dayNum });
        } else {
          paddedDays.push({ type: 'empty' });
        }
      }
      
      // Add all available days
      paddedDays.push(...monthDays.map(d => ({ type: 'active', ...d })));
      
      // Add disabled days after last available day (same month)
      const [year, monthNum] = lastAvailableDay.monthYear.split('-').map(Number);
      const lastDayOfMonth = new Date(year, monthNum + 1, 0).getDate();
      
      for (let i = lastDayOfWeek + 1; i < 7; i++) {
        const dayNum = lastAvailableDay.dayOfMonth + (i - lastDayOfWeek);
        if (dayNum <= lastDayOfMonth) {
          paddedDays.push({ type: 'disabled', dayOfMonth: dayNum });
        } else {
          paddedDays.push({ type: 'empty' });
        }
      }
      
      return {
        month,
        days: paddedDays
      };
    });
    
    setMonthGroups(monthArray);
  }, []);

  const handleDateClick = (date: string) => {
    onSelectDate(date);
    onClose();
  };

  return (
    <div className="calendar-overlay" onClick={onClose}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <h3>Daily Challenges</h3>
          <button onClick={onClose} className="calendar-close">×</button>
        </div>
        <div className="calendar-months">
          {monthGroups.map(({ month, days }) => (
            <div key={month} className="month-section">
              <div className="month-header">{month}</div>
              <div className="weekday-headers">
                <div>M</div>
                <div>T</div>
                <div>W</div>
                <div>T</div>
                <div>F</div>
                <div>S</div>
                <div>S</div>
              </div>
              <div className="days-list">
                {days.map((day, index) => {
                  if (day.type === 'active') {
                    return (
                      <button
                        key={day.date}
                        className={`day-button ${day.isToday ? 'today' : ''} ${completedDates.has(day.date) ? 'completed' : ''}`}
                        onClick={() => handleDateClick(day.date)}
                      >
                        {day.dayOfMonth}
                      </button>
                    );
                  } else if (day.type === 'disabled') {
                    return (
                      <div key={`disabled-${index}`} className="day-disabled">
                        {day.dayOfMonth}
                      </div>
                    );
                  } else {
                    return <div key={`empty-${index}`} className="day-empty"></div>;
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
