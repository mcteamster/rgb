import React from 'react';
import { TimerButton } from './TimerButton';
import { ColorSliders } from './ColorSliders';
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
}

export const PlayerGuesser: React.FC<PlayerGuesserProps> = ({
  selectedColor,
  isColorLocked,
  setIsColorLocked,
  showSliders,
  setShowSliders,
  submitColor,
  deadline,
  timeLimit
}) => {
  const { setPendingSubmission } = useColor();
  
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
    active: !!deadline
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
  };

  return (
    <div className="guessing-phase">
      {showSliders && !isColorLocked && (
        <ColorSliders />
      )}
      <div className="guess-controls-container">
        <div 
          className={`color-preview-square ${isColorLocked ? 'locked' : ''}`}
          onClick={() => !isColorLocked && setShowSliders(!showSliders)}
          style={{
            backgroundColor: `hsl(${Math.round(selectedColor.h)}, ${Math.round(selectedColor.s)}%, ${Math.round(selectedColor.l)}%)`
          }}
        >
          ✏️
        </div>
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
      </div>
    </div>
  );
};
