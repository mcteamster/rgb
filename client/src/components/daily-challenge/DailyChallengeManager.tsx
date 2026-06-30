import React, { useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { getUserName } from '../../utils/userId';
import { Button } from '../Button';
import { PlayerGuesser } from '../PlayerGuesser';

interface DailyChallengeManagerProps {
  onShowAbout: () => void;
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

  // Show results — prev/next challenge navigation
  if (userSubmission) {
    const today = new Date().toLocaleDateString('en-CA');
    const isToday = currentChallenge.challengeId === today;
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 30);
    const MIN_DATE = minDate.toLocaleDateString('en-CA');
    const isFirst = currentChallenge.challengeId <= MIN_DATE;

    const navigate = (offset: number) => {
      const d = new Date(currentChallenge.challengeId);
      d.setDate(d.getDate() + offset);
      setIsColorLocked(false);
      loadChallengeByDate(d.toLocaleDateString('en-CA'));
    };

    return (
      <div className="game-controls results-actions">
        {!isFirst && <Button onClick={() => navigate(-1)} variant="primary">← Previous</Button>}
        {!isToday && (
          <Button onClick={() => navigate(1)} variant="primary">Next →</Button>
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
