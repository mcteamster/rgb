import React from 'react';
import { useColor } from '../contexts/ColorContext';

interface GameTitleProps {
  prefix?: string;
}

export const GameTitle: React.FC<GameTitleProps> = ({ prefix = 'On' }) => {
  const { wheelGeometry } = useColor();
  const dynamicFontSize = Math.max(wheelGeometry.size * 0.10, 20);

  return (
    <div className="game-title">
      <div style={{ 
        fontSize: `${dynamicFontSize * 0.7}px`,
        fontStyle: prefix === 'Off' ? 'italic' : 'normal',
        textTransform: prefix === 'Off' ? 'uppercase' : 'none'
      }}>
        {prefix} the
      </div>
      <div style={{ fontSize: `${dynamicFontSize}px` }}>
        SPECTRUM
      </div>
    </div>
  );
};
