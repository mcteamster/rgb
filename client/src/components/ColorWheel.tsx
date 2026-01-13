import React, { useRef, useEffect } from 'react';
import { hslToRgb, cartesianToPolar, calculateSaturationFromAngle, calculateLightnessFromDistance } from '../utils/colorUtils';
import { useColor } from '../contexts/ColorContext';

interface ColorWheelProps {
  size: number;
}

export const ColorWheel: React.FC<ColorWheelProps> = ({ size }) => {
  const { selectedHue, selectedColor, clickPosition, handleColorClick, handleHueChange, setWheelSize, updateClickPositionFromColor } = useColor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<'hue' | 'sl' | null>(null);
  const center = size / 2;
  const radius = center - 10;
  const markerRadius = Math.max(Math.min(size * 0.01, 6), 2); // 1% of wheel size, max 6px, min 2px

  useEffect(() => {
    setWheelSize(size);
    updateClickPositionFromColor();
  }, [size, setWheelSize, updateClickPositionFromColor]);

  const calculateSL = (distance: number, angle: number) => {
    const normalizedDistance = Math.min(distance / (radius * 0.7), 1);
    const s = calculateSaturationFromAngle(angle);
    const l = calculateLightnessFromDistance(normalizedDistance);
    return { s: Math.max(0, Math.min(1, s)), l: Math.max(0, Math.min(1, l)) };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    
    // Fill entire canvas with selected color as background
    const [bgR, bgG, bgB] = hslToRgb(selectedColor.h, selectedColor.s, selectedColor.l);
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
    ctx.fillRect(0, 0, size, size);
    
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const { distance, angle } = cartesianToPolar(x, y, center);
        const index = (y * size + x) * 4;
        
        if (distance <= radius && distance >= radius * 0.7) {
          const [r, g, b] = hslToRgb(angle, 1, 0.5);
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        } else if (distance < radius * 0.7) {
          const { s, l } = calculateSL(distance, angle);
          const [r, g, b] = hslToRgb(selectedHue, s, l);
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);

    // Draw separating ring
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.7, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw outer border of hue ring with selected color
    const [r, g, b] = hslToRgb(selectedColor.h, selectedColor.s, selectedColor.l);
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 0;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw hue indicator (triangle)
    const hueAngle = selectedHue * Math.PI / 180;
    
    // Calculate distance from inner circle to hue ring center
    const innerRadius = radius * 0.7;
    const hueRingCenter = radius * 0.85;
    const triangleLength = hueRingCenter - innerRadius;
    
    // Scale triangle to fit the available space
    const scaledSize = triangleLength * 1.2; // Base width
    
    // Position triangle starting from inner circle
    const baseX = center + innerRadius * Math.cos(hueAngle);
    const baseY = center + innerRadius * Math.sin(hueAngle);
    
    // Tip points to hue ring center
    const tipX = center + hueRingCenter * Math.cos(hueAngle);
    const tipY = center + hueRingCenter * Math.sin(hueAngle);
    
    const perpAngle = hueAngle + Math.PI / 2;
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    // Triangle tip (at hue ring center)
    ctx.moveTo(tipX, tipY);
    // Base vertices (at inner circle, equilateral)
    ctx.lineTo(baseX + (scaledSize / 2) * Math.cos(perpAngle), 
               baseY + (scaledSize / 2) * Math.sin(perpAngle));
    ctx.lineTo(baseX - (scaledSize / 2) * Math.cos(perpAngle), 
               baseY - (scaledSize / 2) * Math.sin(perpAngle));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw SV indicator
    if (clickPosition) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(clickPosition.x, clickPosition.y, markerRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [size, center, radius, selectedHue, selectedColor, clickPosition, markerRadius]);

  const handleInteraction = (x: number, y: number, isStart: boolean) => {
    const { distance, angle } = cartesianToPolar(x, y, center);

    if (isStart) {
      if (distance <= radius && distance >= radius * 0.7) {
        dragModeRef.current = 'hue';
        handleHueChange(angle);
      } else if (distance < radius * 0.7) {
        dragModeRef.current = 'sl';
        const { s, l } = calculateSL(distance, angle);
        handleColorClick(x, y, { h: selectedHue, s, l });
      }
    } else {
      if (dragModeRef.current === 'hue') {
        handleHueChange(angle);
      } else if (dragModeRef.current === 'sl') {
        if (distance < radius * 0.7) {
          const { s, l } = calculateSL(distance, angle);
          handleColorClick(x, y, { h: selectedHue, s, l });
        } else {
          // Outside SL circle but still in SL drag mode - clamp position to border
          const clampedDistance = radius * 0.7;
          const clampedX = center + clampedDistance * Math.cos(angle * Math.PI / 180);
          const clampedY = center + clampedDistance * Math.sin(angle * Math.PI / 180);
          const { s, l } = calculateSL(clampedDistance, angle);
          handleColorClick(clampedX, clampedY, { h: selectedHue, s, l });
        }
      }
    }
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onMouseDown={(e) => {
        const { x, y } = getCoords(e);
        handleInteraction(x, y, true);
      }}
      onMouseUp={() => dragModeRef.current = null}
      onMouseLeave={() => dragModeRef.current = null}
      onMouseMove={(e) => {
        if (e.buttons === 1) {
          const { x, y } = getCoords(e);
          handleInteraction(x, y, false);
        }
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const { x, y } = getCoords(e);
        handleInteraction(x, y, true);
      }}
      onTouchEnd={() => dragModeRef.current = null}
      onTouchMove={(e) => {
        e.preventDefault();
        const { x, y } = getCoords(e);
        handleInteraction(x, y, false);
      }}
      className="color-wheel"
    />
  );
};
