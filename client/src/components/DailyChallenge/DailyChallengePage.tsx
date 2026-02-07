import React, { useEffect, useState } from 'react';
import { ColorWheel } from '../ColorWheel';
import { RainbowIcon } from '../RainbowIcon';
import { ConnectionStatus } from '../ConnectionStatus';
import { GameNavbar } from '../GameNavbar';
import { GameTitle } from '../GameTitle';
import { GameManager } from '../GameManager';
import { AboutPage } from '../AboutPage';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { setBodyBackground } from '../../utils/colorUtils';
import { DailyChallengeSubmission } from './DailyChallengeSubmission';
import { DailyChallengePrompt } from './DailyChallengePrompt';
import { DailyChallengeResults } from './DailyChallengeResults';

export const DailyChallengePage: React.FC = () => {
    const { selectedColor } = useColor();
    const { currentChallenge, userSubmission, loadCurrentChallenge, isLoading } = useDailyChallenge();
    const [showAbout, setShowAbout] = useState(false);
    const [size, setSize] = useState(() => {
        return { width: window.innerWidth, height: window.innerHeight };
    });

    useEffect(() => {
        loadCurrentChallenge();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    useEffect(() => {
        setBodyBackground(selectedColor);
    }, [selectedColor]);

    if (isLoading) {
        return (
            <div className="app-container">
                <RainbowIcon onShowAbout={() => setShowAbout(true)} />
                <ConnectionStatus />
                <GameNavbar />
                <div className="status-bar">
                    <div className="loading-message">Loading today's challenge...</div>
                </div>
                <ColorWheel size={size} />
                {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
            </div>
        );
    }

    if (!currentChallenge) {
        return (
            <div className="app-container">
                <RainbowIcon onShowAbout={() => setShowAbout(true)} />
                <ConnectionStatus />
                <GameNavbar />
                <div className="status-bar">
                    <div className="error-message">No challenge available today</div>
                </div>
                <ColorWheel size={size} />
                {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
            </div>
        );
    }

    return (
        <div className="app-container">
            <RainbowIcon onShowAbout={() => setShowAbout(true)} />
            <ConnectionStatus />
            <GameNavbar dailyChallengeMode={true} />
            <GameTitle prefix="Off" />
            
            {userSubmission ? (
                <DailyChallengeResults />
            ) : (
                <>
                    <DailyChallengePrompt />
                    <GameManager 
                        onShowAbout={() => setShowAbout(true)}
                        dailyChallengeMode={true}
                        dailyChallengeSubmission={<DailyChallengeSubmission />}
                    />
                </>
            )}
            
            <ColorWheel size={size} />
            {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
        </div>
    );
};
