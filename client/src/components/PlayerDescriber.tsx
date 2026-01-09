import React, { useRef, useEffect } from 'react';
import { TimerButton } from './TimerButton';
import { useTimer } from '../hooks/useTimer';

interface PlayerDescriberProps {
  description: string;
  setDescription: (desc: string) => void;
  onSubmit: () => void;
  targetColor: { h: number; s: number; l: number };
  deadline?: string;
  timeLimit: number;
  updateDraftDescription: (desc: string) => void;
  inputDisabled: boolean;
}

export const PlayerDescriber: React.FC<PlayerDescriberProps> = ({
  description,
  setDescription,
  onSubmit,
  targetColor,
  deadline,
  timeLimit,
  updateDraftDescription,
  inputDisabled
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef(description);
  const draftUpdateTimeoutRef = useRef<NodeJS.Timeout>();
  const enterPressCountRef = useRef(0);
  const enterTimeoutRef = useRef<NodeJS.Timeout>();
  const [showEnterAgain, setShowEnterAgain] = React.useState(false);

  const timer = useTimer({
    deadline,
    timeLimit,
    onTimeUp: () => {
      // Don't send anything - let server handle the timeout
    },
    active: !!deadline
  });

  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  useEffect(() => {
    if (deadline) {
      setDescription('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [deadline, setDescription]);

  const formatText = (text: string) => {
    if (text.length <= 30) return text;
    let breakPoint = 30;
    for (let i = 30; i >= 20; i--) {
      if (text[i] === ' ') {
        breakPoint = i;
        break;
      }
    }
    if (breakPoint === 30 && text[30] !== ' ') {
      return text.substring(0, 30) + '\n' + text.substring(30);
    }
    return text.substring(0, breakPoint) + '\n' + text.substring(breakPoint + 1);
  };

  const formattedDescription = formatText(description);
  const lineCount = formattedDescription.split('\n').length;
  const topPadding = Math.max(1, 3.25 - (lineCount - 1));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, position: 'relative', height: '80px' }}>
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: `hsl(${targetColor.h}, ${targetColor.s}%, ${targetColor.l}%)`,
              border: '2px solid #ccc',
              borderRadius: '4px',
              zIndex: 1
            }}
          />
          <textarea
            ref={textareaRef}
            value={formattedDescription}
            onChange={(e) => {
              const text = e.target.value.replace(/\n/g, ' ');
              if (text.length <= 50) {
                setDescription(text);
                
                // Send draft description update after 500ms of no changes
                if (draftUpdateTimeoutRef.current) {
                  clearTimeout(draftUpdateTimeoutRef.current);
                }
                
                if (deadline && !inputDisabled) {
                  draftUpdateTimeoutRef.current = setTimeout(() => {
                    updateDraftDescription(text.trim());
                  }, 500);
                }
              }
            }}
            placeholder="Describe this color"
            maxLength={50}
            disabled={inputDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                enterPressCountRef.current += 1;
                
                if (enterTimeoutRef.current) {
                  clearTimeout(enterTimeoutRef.current);
                }
                
                if (enterPressCountRef.current >= 2) {
                  enterPressCountRef.current = 0;
                  setShowEnterAgain(false);
                  onSubmit();
                } else {
                  setShowEnterAgain(true);
                  // Reset count after 1 second if second Enter not pressed
                  enterTimeoutRef.current = setTimeout(() => {
                    enterPressCountRef.current = 0;
                    setShowEnterAgain(false);
                  }, 1000);
                }
              }
            }}
            style={{ 
              zIndex: 2, 
              position: 'relative', 
              height: '100%', 
              resize: 'none',
              padding: `${topPadding}ch 10px 10px 10px`,
              textAlign: 'center',
              fontSize: '16px',
              color: targetColor.l > 50 ? '#000' : '#fff',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              '--placeholder-color': targetColor.l > 50 ? '#666' : '#ccc'
            } as React.CSSProperties & { '--placeholder-color': string }}
          />
          <div 
            style={{
              position: 'absolute',
              bottom: '5px',
              right: '10px',
              fontSize: '12px',
              color: targetColor.l > 50 ? '#666' : '#ccc',
              zIndex: 3,
              pointerEvents: 'none'
            }}
          >
            {50 - description.length}
          </div>
        </div>
      </div>
      <TimerButton
        onClick={onSubmit}
        disabled={!description.trim()}
        timerUp={timer.isUp}
        timerActive={timer.isActive}
        timerProgress={timer.progress}
        countdown={timer.countdown}
        targetColor={targetColor}
      >
        {timer.isUp ? 'Sending' : showEnterAgain ? 'Press Enter Again' : 'Send Clue'}
      </TimerButton>
    </>
  );
};
