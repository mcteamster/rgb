import React from 'react';
import { TimerButton } from './TimerButton';
import { useTimer } from '../hooks/useTimer';
import { HSLColor } from '../types/game';
import { useColor } from '../contexts/ColorContext';

interface PlayerGuesserProps {
  selectedColor: HSLColor;
  isColorLocked: boolean;
  setIsColorLocked: (locked: boolean) => void;
  setShowSliders: (show: boolean) => void;
  submitColor: (color: HSLColor) => void;
  deadline?: string;
  timeLimit: number;
}

export const PlayerGuesser: React.FC<PlayerGuesserProps> = ({
  selectedColor,
  isColorLocked,
  setIsColorLocked,
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
          h: selectedColor.h,
          s: Math.round(selectedColor.s * 100),
          l: Math.round(selectedColor.l * 100)
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
        h: selectedColor.h,
        s: Math.round(selectedColor.s * 100),
        l: Math.round(selectedColor.l * 100)
      };
      submitColor(serverColor);
    }
    setShowSliders(false);
  };

  return (
    <div className="guessing-phase">
      <div className="guess-controls">
        <div className="current-color-preview">
          <div 
            className="color-preview color-accurate"
            onClick={() => !isColorLocked && setShowSliders(true)}
            style={{
              backgroundColor: `hsl(${selectedColor.h}, ${selectedColor.s * 100}%, ${selectedColor.l * 100}%)`,
              cursor: isColorLocked ? 'not-allowed' : 'pointer',
              width: '100%',
              height: '60px',
              position: 'relative',
              borderRadius: '4px',
              border: '2px solid #888'
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                width: '80%',
                color: selectedColor.l > 0.5 ? 'black' : 'white'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>H: {Math.round(selectedColor.h)}°</div>
              <div style={{ fontWeight: 'bold' }}>S: {Math.round(selectedColor.s * 100)}%</div>
              <div style={{ fontWeight: 'bold' }}>L: {Math.round(selectedColor.l * 100)}%</div>
            </div>
            <div 
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                fontSize: '12px',
                color: selectedColor.l > 0.5 ? 'black' : 'white',
                opacity: 0.8
              }}
            >
              ✏️
            </div>
          </div>
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
            s: selectedColor.s * 100,
            l: selectedColor.l * 100
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
