import { useState, useEffect } from 'react';

export function useCyclingText(texts: string[], interval = 3000, enabled = true) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!enabled || texts.length < 2) return;
    const timer = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setDisplayIndex((prev) => (prev + 1) % texts.length);
        setExiting(false);
      }, 300);
    }, interval);
    return () => clearInterval(timer);
  }, [enabled, texts.length, interval]);

  return { displayIndex, exiting };
}
