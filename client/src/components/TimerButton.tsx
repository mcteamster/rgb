import React from 'react';
import { Button } from './Button';

interface TimerButtonProps {
  onClick: () => void;
  disabled?: boolean;
  timerUp: boolean;
  timerActive: boolean;
  timerProgress: number;
  countdown: number;
  targetColor: {
    h: number;
    s: number;
    l: number;
  };
  children: React.ReactNode;
}

export const TimerButton: React.FC<TimerButtonProps> = ({
  onClick,
  disabled = false,
  timerUp,
  timerActive,
  timerProgress,
  countdown,
  targetColor,
  children
}) => {
  return (
    <Button 
      onClick={onClick} 
      disabled={disabled}
      style={{ 
        background: timerUp
          ? `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`
          : timerActive 
          ? `linear-gradient(to right, hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%) ${timerProgress}%, hsl(${targetColor.h}, 0%, ${Math.max(0, targetColor.l - 15)}%) ${timerProgress}%)`
          : `hsl(${targetColor.h}, 0%, ${Math.max(0, targetColor.l - 15)}%)`,
        color: targetColor.l > 50 ? '#000' : '#fff',
        marginTop: '1rem',
        fontWeight: 'bold',
        border: '2px solid #888',
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {children}
        {timerActive && countdown > 0 ? <span>{!disabled && '⏳'} {countdown}s</span> : <span>✅</span>}
      </div>
    </Button>
  );
};
