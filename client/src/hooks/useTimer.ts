import { useState, useEffect, useRef } from 'react';

interface UseTimerOptions {
  deadline?: string;
  timeLimit: number; // in seconds
  onTimeUp: () => void;
  active: boolean;
}

interface TimerState {
  progress: number;
  countdown: number;
  isActive: boolean;
  isUp: boolean;
}

export const useTimer = ({ deadline, timeLimit, onTimeUp, active }: UseTimerOptions): TimerState => {
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isUp, setIsUp] = useState(false);
  const callbackRef = useRef(onTimeUp);

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    if (active && deadline) {
      const deadlineTime = new Date(deadline).getTime();
      const now = Date.now();
      
      // Don't start timer if deadline has already passed
      if (deadlineTime <= now) {
        setIsActive(false);
        setProgress(0);
        setIsUp(false);
        setCountdown(0);
        return;
      }
      
      // Don't start timer if deadline is more than 1 hour in the future (unlimited time)
      const oneHour = 60 * 60 * 1000;
      if (deadlineTime - now > oneHour) {
        setIsActive(false);
        setProgress(0);
        setIsUp(false);
        setCountdown(0);
        return;
      }
      
      setIsActive(true);
      setProgress(0);
      setIsUp(false);
      
      const configTimeLimit = timeLimit * 1000;
      
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = deadlineTime - now;
        
        setCountdown(Math.ceil(Math.max(0, remaining / 1000)));
        
        if (remaining > configTimeLimit) {
          setProgress(0);
        } else {
          const progressValue = Math.min((configTimeLimit - remaining) / configTimeLimit, 1);
          setProgress(progressValue * 100);
        }
        
        if (remaining <= 0 || now >= deadlineTime) {
          clearInterval(interval);
          setIsActive(false);
          setIsUp(true);
          setCountdown(0);
          setTimeout(() => {
            callbackRef.current();
          }, 1000);
        }
      }, 50);
      
      return () => clearInterval(interval);
    } else {
      setIsActive(false);
      setProgress(0);
      setIsUp(false);
      setCountdown(0);
    }
  }, [active, deadline, timeLimit]);

  return {
    progress,
    countdown,
    isActive,
    isUp
  };
};
