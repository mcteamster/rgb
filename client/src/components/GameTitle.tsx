import React from 'react';
import { useColor } from '../contexts/ColorContext';

export const GameTitle: React.FC = () => {
  const { wheelGeometry } = useColor();
  const dynamicFontSize = Math.max(wheelGeometry.size * 0.10, 20);

  return (
    <div className="game-title">
      <div style={{ fontSize: `${dynamicFontSize * 0.7}px` }}>
        On the
      </div>
      <div style={{ fontSize: `${dynamicFontSize}px` }}>
        SPECTRUM
      </div>
    </div>
  );
};
