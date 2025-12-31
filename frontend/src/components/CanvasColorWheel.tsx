import React, { useRef, useEffect } from 'react';
import { HSVColor, hsvToRgb, cartesianToPolar } from '../colorUtils';

interface CanvasColorWheelProps {
  size: number;
  selectedHue: number;
  selectedColor: HSVColor;
  clickPosition: { x: number; y: number } | null;
  onColorClick: (x: number, y: number, hsv: HSVColor) => void;
  onHueChange: (hue: number) => void;
}

export const CanvasColorWheel: React.FC<CanvasColorWheelProps> = ({ size, selectedHue, selectedColor, clickPosition, onColorClick, onHueChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const center = size / 2;
  const radius = center - 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    // Render hue circle
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const { distance, angle } = cartesianToPolar(x, y, center);
        
        if (distance <= radius && distance >= radius * 0.7) {
          const [r, g, b] = hsvToRgb(angle, 1, 1);
          const index = (y * size + x) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Render SV triangle with selected hue
    const imageData2 = ctx.getImageData(0, 0, size, size);
    const data2 = imageData2.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const { distance } = cartesianToPolar(x, y, center);
        if (distance < radius * 0.7) {
          const normalizedDistance = distance / (radius * 0.7);
          const s = Math.pow(1 - normalizedDistance, 0.3); // stronger curve for more high saturation area
          const v = Math.pow(1 - (y - (center - radius * 0.7)) / (radius * 1.4), 0.5); // non-linear brightness for more bright colors
          
          const [r, g, b] = hsvToRgb(selectedHue, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, v)));
          const index = (y * size + x) * 4;
          data2[index] = r;
          data2[index + 1] = g;
          data2[index + 2] = b;
          data2[index + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData2, 0, 0);

    // Draw hue indicator
    const hueAngle = selectedHue * Math.PI / 180;
    const innerX = center + (radius * 0.7) * Math.cos(hueAngle);
    const innerY = center + (radius * 0.7) * Math.sin(hueAngle);
    const outerX = center + radius * Math.cos(hueAngle);
    const outerY = center + radius * Math.sin(hueAngle);
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw SV indicator at click position
    if (clickPosition) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(clickPosition.x, clickPosition.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [size, center, radius, selectedHue, selectedColor, clickPosition]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { distance, angle } = cartesianToPolar(x, y, center);

    if (distance <= radius && distance >= radius * 0.7) {
      // Hue selection - only update hue
      onHueChange(angle);
    } else if (distance < radius * 0.7) {
      // SV selection - only place cube if hue is selected
      const normalizedDistance = distance / (radius * 0.7);
      const s = Math.pow(1 - normalizedDistance, 0.3); // stronger curve for more high saturation area
      const v = Math.pow(1 - (y - (center - radius * 0.7)) / (radius * 1.4), 0.5); // non-linear brightness for more bright colors
      const hsv: HSVColor = { h: selectedHue, s: Math.max(0, Math.min(1, s)), v: Math.max(0, Math.min(1, v)) };
      onColorClick(x, y, hsv);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onClick={handleClick}
      style={{ border: '2px solid #333', borderRadius: '50%', cursor: 'pointer' }}
    />
  );
};
