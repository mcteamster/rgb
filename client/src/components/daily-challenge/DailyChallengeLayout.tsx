import React from 'react';
import { RainbowIcon } from '../RainbowIcon';
import { ConnectionStatus } from '../ConnectionStatus';
import { GameNavbar } from '../GameNavbar';
import { ColorWheel } from '../ColorWheel';
import { AboutPage } from '../AboutPage';

interface DailyChallengeLayoutProps {
  children: React.ReactNode;
  size: { width: number; height: number };
  showAbout: boolean;
  onShowAbout: () => void;
  onCloseAbout: () => void;
  dailyChallengeMode?: boolean;
  onToggleHistory?: () => void;
  isLoading?: boolean;
  onShowTips?: () => void;
  challengeDate?: string;
}

export const DailyChallengeLayout: React.FC<DailyChallengeLayoutProps> = ({
  children,
  size,
  showAbout,
  onShowAbout,
  onCloseAbout,
  dailyChallengeMode = false,
  onToggleHistory,
  isLoading,
  onShowTips,
  challengeDate
}) => (
  <div className="app-container">
    <RainbowIcon onShowAbout={onShowAbout} />
    <ConnectionStatus />
    <GameNavbar 
      dailyChallengeMode={dailyChallengeMode} 
      onToggleHistory={onToggleHistory} 
      isLoading={isLoading}
      challengeDate={challengeDate}
    />
    {children}
    <ColorWheel size={size} />
    {showAbout && <AboutPage onClose={onCloseAbout} onShowTips={onShowTips} />}
  </div>
);
