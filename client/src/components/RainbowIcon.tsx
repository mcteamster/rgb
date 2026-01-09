import React from 'react';

interface RainbowIconProps {
  onShowAbout: () => void;
}

export const RainbowIcon: React.FC<RainbowIconProps> = ({ onShowAbout }) => {
  return (
    <div 
      className="icon rainbow-icon" 
      onClick={onShowAbout}
    >
      🌈
    </div>
  );
};
