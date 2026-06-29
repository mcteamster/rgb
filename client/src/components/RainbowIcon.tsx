import React from 'react';
import { Rainbow } from 'lucide-react';

interface RainbowIconProps {
  onShowAbout: () => void;
}

export const RainbowIcon: React.FC<RainbowIconProps> = ({ onShowAbout }) => {
  return (
    <div 
      className="icon rainbow-icon" 
      onClick={onShowAbout}
    >
      <Rainbow size={28} />
    </div>
  );
};
