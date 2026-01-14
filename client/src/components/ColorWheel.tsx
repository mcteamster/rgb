import React, { useRef, useEffect, useCallback } from 'react';
import { hslToRgb, cartesianToPolar, calculateSaturationFromAngle, calculateLightnessFromDistance } from '../utils/colorUtils';
import { useColor } from '../contexts/ColorContext';

interface ColorWheelProps {
  size: { width: number; height: number };
}

export const ColorWheel: React.FC<ColorWheelProps> = ({ size }) => {
  const { selectedHue, selectedColor, clickState, handleColorClick, handleHueChange, setWheelGeometry, updateClickPositionFromColor } = useColor();
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<'hue' | 'sl' | null>(null);
  const wheelCacheRef = useRef<{ hue: number; canvas: HTMLCanvasElement } | null>(null);
  const rafRef = useRef<number>();
  
  const wheelSize = Math.min(size.height * 0.6, size.width * 0.8);
  const radius = wheelSize / 2 - 10;
  const canvasSize = Math.ceil(wheelSize);
  const center = canvasSize / 2;
  const markerRadius = Math.max(Math.min(wheelSize * 0.01, 6), 2);

  const prevCanvasSizeRef = useRef(canvasSize);
  
  useEffect(() => {
    setWheelGeometry({ size: wheelSize, center, radius });
    if (prevCanvasSizeRef.current !== canvasSize) {
      wheelCacheRef.current = null; // Invalidate cache only on canvas size change
      prevCanvasSizeRef.current = canvasSize;
    }
  }, [wheelSize, center, radius, canvasSize, setWheelGeometry]);
  
  useEffect(() => {
    updateClickPositionFromColor();
  }, [updateClickPositionFromColor]);

  const calculateSL = (distance: number, angle: number) => {
    const normalizedDistance = Math.min(distance / (radius * 0.7), 1);
    const s = calculateSaturationFromAngle(angle);
    const l = calculateLightnessFromDistance(normalizedDistance);
    return { s: Math.max(0, Math.min(100, s)), l: Math.max(0, Math.min(100, l)) };
  };

  const renderWheelToCache = useCallback((hue: number) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasSize;
    offscreen.height = canvasSize;
    const ctx = offscreen.getContext('2d', { willReadFrequently: false })!;
    
    const imageData = ctx.createImageData(canvasSize, canvasSize);
    const data = imageData.data;

    for (let y = 0; y < canvasSize; y++) {
      for (let x = 0; x < canvasSize; x++) {
        const { distance, angle } = cartesianToPolar(x, y, center);
        const index = (y * canvasSize + x) * 4;
        
        if (distance <= radius && distance >= radius * 0.7) {
          const [r, g, b] = hslToRgb(angle, 100, 50);
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        } else if (distance < radius * 0.7) {
          const { s, l } = calculateSL(distance, angle);
          const [r, g, b] = hslToRgb(hue, s, l);
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        } else {
          data[index + 3] = 0; // Transparent background
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.7, 0, 2 * Math.PI);
    ctx.stroke();

    wheelCacheRef.current = { hue, canvas: offscreen };
    return offscreen;
  }, [canvasSize, center, radius, calculateSL]);

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw outer ring with selected color
    const [r, g, b] = hslToRgb(selectedColor.h, selectedColor.s, selectedColor.l);
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw hue indicator
    const hueAngle = selectedHue * Math.PI / 180;
    const innerRadius = radius * 0.7;
    const hueRingCenter = radius * 0.85;
    const triangleLength = hueRingCenter - innerRadius;
    const scaledSize = triangleLength * 1.2;
    
    const baseX = center + innerRadius * Math.cos(hueAngle);
    const baseY = center + innerRadius * Math.sin(hueAngle);
    const tipX = center + hueRingCenter * Math.cos(hueAngle);
    const tipY = center + hueRingCenter * Math.sin(hueAngle);
    const perpAngle = hueAngle + Math.PI / 2;
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + (scaledSize / 2) * Math.cos(perpAngle), 
               baseY + (scaledSize / 2) * Math.sin(perpAngle));
    ctx.lineTo(baseX - (scaledSize / 2) * Math.cos(perpAngle), 
               baseY - (scaledSize / 2) * Math.sin(perpAngle));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw SL indicator
    if (clickState.position) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(clickState.position.x, clickState.position.y, markerRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [canvasSize, center, radius, selectedHue, selectedColor, clickState.position, markerRadius]);

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;

    const ctx = background.getContext('2d')!;
    const [bgR, bgG, bgB] = hslToRgb(selectedColor.h, selectedColor.s, selectedColor.l);
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
    ctx.fillRect(0, 0, 1, 1);
  }, [selectedColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    
    // Use cached wheel or render new one
    const cached = wheelCacheRef.current;
    const wheelCanvas = (cached?.hue === selectedHue) 
      ? cached.canvas 
      : renderWheelToCache(selectedHue);
    
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(wheelCanvas, 0, 0);
  }, [canvasSize, selectedHue, renderWheelToCache]);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawOverlay);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [drawOverlay]);

  const handleInteraction = useCallback((x: number, y: number, isStart: boolean) => {
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
  }, [center, radius, selectedHue, handleHueChange, handleColorClick, calculateSL]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { 
      x: clientX - rect.left, 
      y: clientY - rect.top 
    };
  };

  return (
    <div style={{ 
      position: 'relative', 
      width: canvasSize, 
      height: canvasSize,
      transform: 'translate(-50%, -50%)',
    }} className="color-wheel">
      <canvas
        ref={backgroundRef}
        width={1}
        height={1}
        style={{ position: 'fixed', top: '50%', left: '50%', width: '100vw', height: '100vh', imageRendering: 'pixelated', transform: 'translate(-50%, -50%)' }}
      />
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      <canvas
        ref={overlayRef}
        width={canvasSize}
        height={canvasSize}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      <canvas
        width={canvasSize}
        height={canvasSize}
        style={{ position: 'absolute', top: 0, left: 0 }}
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
      />
    </div>
  );
};
