import React from 'react';
import { useColor } from '../contexts/ColorContext';

export const GameTitle: React.FC = () => {
  const { wheelSize } = useColor();
  const dynamicFontSize = Math.max(wheelSize * 0.10, 20);

  return (
    <div 
      className="game-title"
      style={{ fontSize: `${dynamicFontSize}px` }}
    >
      <span style={{ fontSize: '0.7em' }}>On the</span><br />SPECTRUM
    </div>
  );
};
