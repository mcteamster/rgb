import React, { useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { getUserName } from '../../utils/userId';
import { Button } from '../Button';
import { PlayerGuesser } from '../PlayerGuesser';

interface DailyChallengeManagerProps {
  onShowTips?: () => void;
}

export const DailyChallengeManager: React.FC<DailyChallengeManagerProps> = ({ 
  onShowTips, 
}) => {
  const { selectedColor, isColorLocked, setIsColorLocked, showSliders, setShowSliders } = useColor();
  const { currentChallenge, userSubmission, submitColor: submitDailyColor, loadChallengeByDate, error, isLoading } = useDailyChallenge();
  const [userName] = useState(getUserName());

  if (!currentChallenge) return null;

  const handleDailyChallengeSubmit = async (color: { h: number; s: number; l: number }) => {
    await submitDailyColor(color, userName);
  };

  const today = new Date().toLocaleDateString('en-CA');
  const isToday = currentChallenge.challengeId === today;
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 30);
  const MIN_DATE = minDate.toLocaleDateString('en-CA');
  const isFirst = currentChallenge.challengeId <= MIN_DATE;

  const goToChallenge = (offset: number) => {
    // Parse date parts directly to avoid UTC-midnight parse shifting the date
    // in timezones east of UTC (e.g. AEST: new Date('2026-07-01') = Jun 30 locally)
    const [y, m, d] = currentChallenge.challengeId.split('-').map(Number);
    const date = new Date(y, m - 1, d + offset); // local date constructor, no UTC shift
    setIsColorLocked(false);
    loadChallengeByDate(date.toLocaleDateString('en-CA'));
  };

  // Show results — prev/next challenge navigation
  if (userSubmission) {
    return (
      <div className="game-controls results-actions">
        {!isFirst && <Button onClick={() => goToChallenge(-1)} variant="primary">Previous</Button>}
        {!isToday && (
          <Button onClick={() => goToChallenge(1)} variant="primary">Next</Button>
        )}
      </div>
    );
  }

  // Show submission form
  return (
    <div className="game-controls">
      <PlayerGuesser
        selectedColor={selectedColor}
        isColorLocked={isColorLocked}
        setIsColorLocked={setIsColorLocked}
        showSliders={showSliders}
        setShowSliders={setShowSliders}
        submitColor={handleDailyChallengeSubmit}
        deadline={undefined}
        timeLimit={0}
        onShowTips={onShowTips}
        dailyChallengeMode={true}
        isSubmitting={isLoading}
      />
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
