import React from 'react';
import { useColor } from '../contexts/ColorContext';

export const GameTitle: React.FC = () => {
  const { wheelGeometry } = useColor();
  const dynamicFontSize = Math.max(wheelGeometry.size * 0.10, 20);

  return (
    <>
      <div 
        className="game-title"
        style={{ fontSize: `${dynamicFontSize * 0.7}px`, top: 'calc(50% - 1em + 0.75rem)', transform: 'translate(-50%, -100%)' }}
      >
        On the
      </div>
      <div 
        className="game-title"
        style={{ fontSize: `${dynamicFontSize}px`, top: 'calc(50% + 0.75rem)', transform: 'translate(-50%, -50%)' }}
      >
        SPECTRUM
      </div>
    </>
  );
};
