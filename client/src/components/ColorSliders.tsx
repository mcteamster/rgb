import React, { useRef, useEffect } from 'react';
import { useColor } from '../contexts/ColorContext';

interface ColorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
  displayValue: string;
}

const ColorSlider: React.FC<ColorSliderProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  onRelease,
  displayValue
}) => {
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label-large">{label}</span>
        <span className="slider-value-large">{displayValue}</span>
      </div>
      <div className="slider-container">
        <button 
          className="increment-btn" 
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          -
        </button>
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          onMouseUp={onRelease}
          onTouchEnd={onRelease}
        />
        <button 
          className="increment-btn" 
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
};

interface ColorSlidersProps {
  onClose: () => void;
}

export const ColorSliders: React.FC<ColorSlidersProps> = ({ onClose }) => {
  const { selectedColor, setSelectedColor, updateClickPositionFromColor, setSelectedHue } = useColor();
  const updateQueueRef = useRef<Array<{ h: number, s: number, l: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (updateQueueRef.current.length >= 5) {
        updateQueueRef.current = updateQueueRef.current.filter((_, index) => index % 4 === 0);
      }
      if (updateQueueRef.current.length > 0) {
        const nextColor = updateQueueRef.current.shift()!;
        setSelectedColor(nextColor);
        updateClickPositionFromColor();
      }
    }, 10);

    return () => clearInterval(interval);
  }, [updateClickPositionFromColor, setSelectedColor]);

  const handleHSLChange = (component: 'h' | 's' | 'l', value: number) => {
    let newColor = { ...selectedColor };
    if (component === 'h') {
      newColor.h = value;
      setSelectedHue(value);
      setSelectedColor(newColor);
      updateClickPositionFromColor();
    } else if (component === 's') {
      newColor.s = value;
      updateQueueRef.current.push(newColor);
    } else if (component === 'l') {
      newColor.l = value;
      updateQueueRef.current.push(newColor);
    }
  };

  return (
    <div className="hsl-slider-modal">
      <ColorSlider
        label="Hue"
        value={Math.round(selectedColor.h)}
        min={0}
        max={359}
        onChange={(value) => handleHSLChange('h', value)}
        displayValue={`${Math.round(selectedColor.h)}°`}
      />
      <ColorSlider
        label="Saturation"
        value={Math.round(selectedColor.s)}
        min={0}
        max={100}
        onChange={(value) => handleHSLChange('s', value)}
        onRelease={() => updateClickPositionFromColor()}
        displayValue={`${Math.round(selectedColor.s)}%`}
      />
      <ColorSlider
        label="Lightness"
        value={Math.round(selectedColor.l)}
        min={0}
        max={100}
        onChange={(value) => handleHSLChange('l', value)}
        onRelease={() => updateClickPositionFromColor()}
        displayValue={`${Math.round(selectedColor.l)}%`}
      />
      <button className="modal-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
};
