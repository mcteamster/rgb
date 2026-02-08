import React, { useEffect, useState } from 'react';
import { ColorWheel } from './ColorWheel';
import { RainbowIcon } from './RainbowIcon';
import { ConnectionStatus } from './ConnectionStatus';
import { GameNavbar } from './GameNavbar';
import { GameTitle } from './GameTitle';
import { GameManager } from './GameManager';
import { GameDisplay } from './GameDisplay';
import { RoundReveal } from './RoundReveal';
import { GameResults } from './GameResults';
import { Button } from './Button';
import { AboutPage } from './AboutPage';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { useColor } from '../contexts/ColorContext';
import { setBodyBackground } from '../utils/colorUtils';

export const DailyChallenge: React.FC = () => {
    const { selectedColor } = useColor();
    const { currentChallenge, userSubmission, loadCurrentChallenge, isLoading } = useDailyChallenge();
    const [showAbout, setShowAbout] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
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
            
            {showLeaderboard ? (
                <>
                    <GameResults dailyChallengeMode={true} />
                    <div className="game-controls">
                        <Button onClick={() => setShowLeaderboard(false)} variant="back" style={{ width: '100%' }}>
                            Back to Results
                        </Button>
                    </div>
                </>
            ) : userSubmission ? (
                <>
                    <RoundReveal dailyChallengeMode={true} />
                    <GameManager 
                        onShowAbout={() => setShowAbout(true)}
                        dailyChallengeMode={true}
                        onShowLeaderboard={() => setShowLeaderboard(true)}
                    />
                </>
            ) : (
                <>
                    <GameDisplay dailyChallengeMode={true} />
                    <GameManager 
                        onShowAbout={() => setShowAbout(true)}
                        dailyChallengeMode={true}
                    />
                </>
            )}
            
            <ColorWheel size={size} />
            {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
        </div>
    );
};
