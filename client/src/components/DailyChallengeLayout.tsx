import React from 'react';
import { RainbowIcon } from './RainbowIcon';
import { ConnectionStatus } from './ConnectionStatus';
import { GameNavbar } from './GameNavbar';
import { ColorWheel } from './ColorWheel';
import { AboutPage } from './AboutPage';

interface DailyChallengeLayoutProps {
  children: React.ReactNode;
  size: { width: number; height: number };
  showAbout: boolean;
  onShowAbout: () => void;
  onCloseAbout: () => void;
  dailyChallengeMode?: boolean;
}

export const DailyChallengeLayout: React.FC<DailyChallengeLayoutProps> = ({
  children,
  size,
  showAbout,
  onShowAbout,
  onCloseAbout,
  dailyChallengeMode = false
}) => (
  <div className="app-container">
    <RainbowIcon onShowAbout={onShowAbout} />
    <ConnectionStatus />
    <GameNavbar dailyChallengeMode={dailyChallengeMode} />
    {children}
    <ColorWheel size={size} />
    {showAbout && <AboutPage onClose={onCloseAbout} />}
  </div>
);
