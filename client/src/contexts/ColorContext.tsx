import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { HSLColor, calculateDistanceFromLightness, calculateAngleFromSaturation } from '../utils/colorUtils';
import { useGame } from './GameContext';

interface WheelGeometry {
  size: number;
  center: number;
  radius: number;
}

interface ClickState {
  position: { x: number; y: number } | null;
  angle: number;
}

interface ColorContextType {
  selectedColor: HSLColor;
  selectedHue: number;
  clickState: ClickState;
  wheelGeometry: WheelGeometry;
  isColorLocked: boolean;
  showSliders: boolean;
  setSelectedColor: (color: HSLColor) => void;
  setSelectedHue: (hue: number) => void;
  setClickState: (state: Partial<ClickState>) => void;
  setWheelGeometry: (geometry: Partial<WheelGeometry>) => void;
  setIsColorLocked: (locked: boolean) => void;
  setShowSliders: (show: boolean) => void;
  handleColorClick: (x: number, y: number, hsl: HSLColor) => void;
  handleHueChange: (hue: number) => void;
  updateClickPositionFromColor: () => void;
  setPendingSubmission: (pending: boolean) => void;
}

const ColorContext = createContext<ColorContextType | undefined>(undefined);

export const useColor = () => {
  const context = useContext(ColorContext);
  if (!context) {
    throw new Error('useColor must be used within a ColorProvider');
  }
  return context;
};

interface ColorProviderProps {
  children: React.ReactNode;
}

export const ColorProvider: React.FC<ColorProviderProps> = ({ children }) => {
  const [selectedColor, setSelectedColor] = useState<HSLColor>(() => {
    const saved = localStorage.getItem('selectedColor');
    return saved ? JSON.parse(saved) : { h: 270, s: 0, l: 0 };
  });
  const [selectedHue, setSelectedHue] = useState(() => {
    const saved = localStorage.getItem('selectedColor');
    return saved ? JSON.parse(saved).h : 270;
  });
  const [isColorLocked, setIsColorLocked] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  
  const [wheelGeometry, setWheelGeometryState] = useState<WheelGeometry>(() => {
    const size = Math.round(Math.min(window.innerHeight * 0.6, window.innerWidth * 0.8));
    const center = Math.round(Math.max(window.innerHeight, window.innerWidth) / 2);
    return { size, center, radius: size / 2 - 10 };
  });
  
  const setWheelGeometry = useCallback((partial: Partial<WheelGeometry>) => {
    setWheelGeometryState(prev => {
      const updated = { ...prev, ...partial };
      if (partial.size !== undefined) {
        updated.radius = updated.size / 2 - 10;
      }
      return updated;
    });
  }, []);
  
  const [clickState, setClickStateState] = useState<ClickState>({
    position: null,
    angle: 270
  });
  
  const clickAngleRef = useRef(270);
  
  const setClickState = useCallback((partial: Partial<ClickState>) => {
    setClickStateState(prev => {
      const updated = { ...prev, ...partial };
      if (partial.angle !== undefined) {
        clickAngleRef.current = partial.angle;
      }
      return updated;
    });
  }, []);
  
  const { updateDraftColor, getCurrentRound, playerId, gameState } = useGame();
  const draftUpdateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSentDraftColorRef = useRef<HSLColor | null>(null);
  const pendingSubmissionRef = useRef(false);

  // Sync locked state with server submissions
  useEffect(() => {
    const currentRound = getCurrentRound();
    if (currentRound && playerId) {
      const hasSubmission = currentRound.submissions && currentRound.submissions[playerId];
      if (hasSubmission) {
        setIsColorLocked(true);
        pendingSubmissionRef.current = false;
      } else if (!pendingSubmissionRef.current) {
        setIsColorLocked(false);
      }
    }
  }, [getCurrentRound, playerId]);

  // Unlock color when leaving game
  useEffect(() => {
    if (!gameState) {
      setIsColorLocked(false);
    }
  }, [gameState]);

  // Save selected color to localStorage when it changes (if not locked)
  useEffect(() => {
    if (!isColorLocked) {
      localStorage.setItem('selectedColor', JSON.stringify(selectedColor));
    }
  }, [selectedColor, isColorLocked]);

  // Send draft color whenever selectedColor changes (with throttling)
  useEffect(() => {
    if (playerId) {
      // Check if color has actually changed
      const lastSent = lastSentDraftColorRef.current;
      const hasChanged = !lastSent || 
        lastSent.h !== selectedColor.h || 
        lastSent.s !== selectedColor.s || 
        lastSent.l !== selectedColor.l;
      
      if (hasChanged) {
        if (draftUpdateTimeoutRef.current) {
          clearTimeout(draftUpdateTimeoutRef.current);
        }
        
        draftUpdateTimeoutRef.current = setTimeout(() => {
          updateDraftColor(selectedColor);
          lastSentDraftColorRef.current = { ...selectedColor };
        }, 100); // Throttle to 100ms
      }
    }
  }, [selectedColor, playerId, updateDraftColor]);

  // Send initial draft color when player joins/creates game
  useEffect(() => {
    if (playerId && !lastSentDraftColorRef.current) {
      updateDraftColor(selectedColor);
      lastSentDraftColorRef.current = { ...selectedColor };
    }
  }, [playerId, selectedColor, updateDraftColor]);

  const updateClickPositionFromColor = useCallback(() => {
    const radius = wheelGeometry.radius;
    const center = wheelGeometry.center;
    const angle = clickAngleRef.current;
    
    // Calculate base angle from saturation
    let targetAngle = calculateAngleFromSaturation(selectedColor.s);
    
    // Preserve the side of the circle by checking if we're on the left side (90-270 degrees)
    const isOnLeftSide = angle > 90 && angle < 270;
    
    // If we're on the left side and the calculated angle is on the right side, flip it
    if (isOnLeftSide && (targetAngle < 90 || targetAngle > 270)) {
      targetAngle = 180 - targetAngle;
      if (targetAngle < 0) targetAngle += 360;
    }
    // If we're on the right side and the calculated angle is on the left side, flip it
    else if (!isOnLeftSide && targetAngle > 90 && targetAngle < 270) {
      targetAngle = 180 - targetAngle;
      if (targetAngle < 0) targetAngle += 360;
    }
    
    // Calculate distance from lightness
    const normalizedDistance = calculateDistanceFromLightness(selectedColor.l);
    const distance = normalizedDistance * radius * 0.7;
    
    const x = center + distance * Math.cos(targetAngle * Math.PI / 180);
    const y = center + distance * Math.sin(targetAngle * Math.PI / 180);
    
    setClickStateState(prev => ({ ...prev, position: { x, y } }));
  }, [wheelGeometry.radius, wheelGeometry.center, selectedColor.l, selectedColor.s]);

  const handleColorClick = (x: number, y: number, hsl: HSLColor) => {
    if (isColorLocked) return;
    setSelectedColor(hsl);
    // Calculate and store the angle from the click position
    const dx = x - wheelGeometry.center;
    const dy = y - wheelGeometry.center;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    setClickState({ position: { x, y }, angle });
  };

  const handleSetSelectedColor = (color: HSLColor) => {
    if (isColorLocked) return;
    setSelectedColor(color);
  };

  const handleHueChange = (hue: number) => {
    if (isColorLocked) return;
    setSelectedHue(hue);
    const newColor = { h: hue, s: selectedColor.s, l: selectedColor.l };
    setSelectedColor(newColor);
    updateClickPositionFromColor();
  };

  const setPendingSubmission = (pending: boolean) => {
    pendingSubmissionRef.current = pending;
  };

  return (
    <ColorContext.Provider value={{
      selectedColor,
      selectedHue,
      clickState,
      wheelGeometry,
      isColorLocked,
      showSliders,
      setSelectedColor: handleSetSelectedColor,
      setSelectedHue,
      setClickState,
      setWheelGeometry,
      setIsColorLocked,
      setShowSliders,
      handleColorClick,
      handleHueChange,
      updateClickPositionFromColor,
      setPendingSubmission
    }}>
      {children}
    </ColorContext.Provider>
  );
};
