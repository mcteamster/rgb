import React, { useState } from 'react';
import { TimerButton } from './TimerButton';
import { ColorSliders } from './ColorSliders';
import { Button } from './Button';
import { ColorBox } from './ColorBox';
import { useTimer } from '../hooks/useTimer';
import { HSLColor } from '../types/game';
import { useColor } from '../contexts/ColorContext';

interface PlayerGuesserProps {
  selectedColor: HSLColor;
  isColorLocked: boolean;
  setIsColorLocked: (locked: boolean) => void;
  showSliders: boolean;
  setShowSliders: (show: boolean) => void;
  submitColor: (color: HSLColor) => void;
  deadline?: string;
  timeLimit: number;
  onShowTips?: () => void;
  dailyChallengeMode?: boolean;
  isSubmitting?: boolean;
}

export const PlayerGuesser: React.FC<PlayerGuesserProps> = ({
  selectedColor,
  isColorLocked,
  setIsColorLocked,
  showSliders,
  setShowSliders,
  submitColor,
  deadline,
  timeLimit,
  onShowTips,
  dailyChallengeMode = false,
  isSubmitting = false
}) => {
  const { setPendingSubmission } = useColor();
  const [confirming, setConfirming] = useState(false);
  
  const timer = useTimer({
    deadline,
    timeLimit,
    onTimeUp: () => {
      if (!isColorLocked) {
        setIsColorLocked(true);
        const serverColor = {
          h: Math.round(selectedColor.h),
          s: Math.round(selectedColor.s),
          l: Math.round(selectedColor.l)
        };
        submitColor(serverColor);
      }
    },
    active: !!deadline && !dailyChallengeMode
  });

  const handleSubmit = () => {
    if (!isColorLocked) {
      setPendingSubmission(true);
      setIsColorLocked(true);
      const serverColor = {
        h: Math.round(selectedColor.h),
        s: Math.round(selectedColor.s),
        l: Math.round(selectedColor.l)
      };
      submitColor(serverColor);
    }
    setShowSliders(false);
    if (dailyChallengeMode) {
      setConfirming(false);
    }
  };

  const buttonColor = `hsl(${Math.round(selectedColor.h)}, ${Math.round(selectedColor.s)}%, ${Math.round(selectedColor.l)}%)`;
  const textColor = selectedColor.l > 50 ? '#000' : '#fff';

  if (dailyChallengeMode && confirming) {
    return (
      <div className="confirmation-dialog">
        <ColorBox color={selectedColor} label="Your Selected Color" />
        <div className="confirmation-buttons">
          <Button
            onClick={() => setConfirming(false)}
            disabled={isSubmitting}
            variant="exit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="primary"
          >
            {isSubmitting ? 'Submitting...' : 'Confirm'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="guessing-phase">
      {showSliders && !isColorLocked && (
        <ColorSliders onShowTips={onShowTips} />
      )}
      <div className="guess-controls-container">
        <div 
          className={`color-preview-square ${isColorLocked ? 'locked' : ''}`}
          onClick={() => !isColorLocked && setShowSliders(!showSliders)}
          style={{
            backgroundColor: buttonColor
          }}
        >
          ✏️
        </div>
        {dailyChallengeMode ? (
          <Button
            onClick={() => setConfirming(true)}
            disabled={isSubmitting}
            style={{ 
              background: buttonColor,
              color: textColor,
              fontWeight: 'bold',
              border: '2px solid #888',
              flex: 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Submit Color
              <span>✅</span>
            </div>
          </Button>
        ) : (
          <TimerButton
            onClick={handleSubmit}
            disabled={isColorLocked}
            timerUp={timer.isUp}
            timerActive={timer.isActive}
            timerProgress={timer.progress}
            countdown={timer.countdown}
            targetColor={{
              h: selectedColor.h,
              s: selectedColor.s,
              l: selectedColor.l
            }}
          >
            {timer.isUp ? (
              <>
                Submitting
              </>
            ) : isColorLocked ? (
              <>
                Locked In
                <span style={{ fontSize: '16px' }}>🔒</span>
              </>
            ) : (
              'Submit'
            )}
          </TimerButton>
        )}
      </div>
    </div>
  );
};
