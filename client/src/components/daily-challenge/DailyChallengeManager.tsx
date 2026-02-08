import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { getUserName } from '../../utils/userId';
import { Button } from '../Button';
import { PlayerGuesser } from '../PlayerGuesser';

interface DailyChallengeManagerProps {
  onShowAbout: () => void;
  onShowTips?: () => void;
  onShowLeaderboard?: () => void;
}

export const DailyChallengeManager: React.FC<DailyChallengeManagerProps> = ({ 
  onShowAbout, 
  onShowTips, 
  onShowLeaderboard
}) => {
  const navigate = useNavigate();
  const { selectedColor, isColorLocked, setIsColorLocked, showSliders, setShowSliders } = useColor();
  const { currentChallenge, userSubmission, submitColor: submitDailyColor, error, isLoading } = useDailyChallenge();
  const [userName] = useState(getUserName());

  if (!currentChallenge) return null;

  const handleDailyChallengeSubmit = async (color: { h: number; s: number; l: number }) => {
    await submitDailyColor(color, userName);
  };

  // Show results with leaderboard button
  if (userSubmission) {
    return (
      <div className="game-controls">
        <Button onClick={onShowLeaderboard} variant="primary" style={{ width: '100%' }}>
          View Full Leaderboard
        </Button>
        <Button onClick={() => navigate('/')} variant="back" style={{ width: '100%', marginTop: '10px' }}>
          Back to Home
        </Button>
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
