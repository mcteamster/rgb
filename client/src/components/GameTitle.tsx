import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useColor } from '../contexts/ColorContext';

interface GameTitleProps {
  prefix?: string;
  showDailyChallengeLink?: boolean;
}

export const GameTitle: React.FC<GameTitleProps> = ({ prefix = 'On', showDailyChallengeLink = false }) => {
  const { wheelGeometry } = useColor();
  const navigate = useNavigate();
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
      {showDailyChallengeLink && (
        <div 
          style={{ 
            fontSize: `${dynamicFontSize * 0.35}px`,
            marginTop: '8px',
            cursor: 'pointer',
            opacity: 0.8,
            pointerEvents: 'auto'
          }}
          onClick={() => navigate('/daily')}
        >
          ✨ Daily Challenge →
        </div>
      )}
    </div>
  );
};
