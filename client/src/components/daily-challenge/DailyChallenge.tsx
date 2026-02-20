import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameTitle } from '../GameTitle';
import { DailyChallengeManager } from './DailyChallengeManager';
import { DailyChallengeDisplay } from './DailyChallengeDisplay';
import { DailyChallengeReveal } from './DailyChallengeReveal';
import { DailyChallengeResults } from './DailyChallengeResults';
import { DailyChallengeHistory } from './DailyChallengeHistory';
import { Button } from '../Button';
import { DailyChallengeLayout } from './DailyChallengeLayout';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { setBodyBackground } from '../../utils/colorUtils';
import { ColorWheelTips } from '../ColorGuessingTips';
import { getUserId } from '../../utils/userId';

const DAILY_CHALLENGE_TIPS_KEY = 'dailyChallengeTipsSeen';

export const DailyChallenge: React.FC = () => {
    const navigate = useNavigate();
    const { selectedColor, setIsColorLocked } = useColor();
    const { currentChallenge, userSubmission, loadCurrentChallenge, isLoading } = useDailyChallenge();
    const [showAbout, setShowAbout] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showTips, setShowTips] = useState(false);
    const size = useWindowSize();

    useEffect(() => {
        loadCurrentChallenge();
    }, []);

    useEffect(() => {
        setBodyBackground(selectedColor);
    }, [selectedColor]);

    useEffect(() => {
        return () => setIsColorLocked(false);
    }, [setIsColorLocked]);

    useEffect(() => {
        // Show tips on first visit if not submitted yet
        if (currentChallenge && !userSubmission && !isLoading) {
            const tipsSeen = localStorage.getItem(DAILY_CHALLENGE_TIPS_KEY);
            if (!tipsSeen) {
                setShowTips(true);
            }
        }
    }, [currentChallenge, userSubmission, isLoading]);

    const handleCloseTips = () => {
        localStorage.setItem(DAILY_CHALLENGE_TIPS_KEY, 'true');
        setShowTips(false);
    };

    if (isLoading) {
        return (
            <DailyChallengeLayout 
                size={size} 
                showAbout={showAbout} 
                onShowAbout={() => setShowAbout(true)} 
                onCloseAbout={() => setShowAbout(false)}
                dailyChallengeMode
                isLoading
            >
                <GameTitle prefix="Off" />
            </DailyChallengeLayout>
        );
    }

    if (!currentChallenge) {
        return (
            <DailyChallengeLayout size={size} showAbout={showAbout} onShowAbout={() => setShowAbout(true)} onCloseAbout={() => setShowAbout(false)}>
                <div className="status-bar">
                    <div className="error-message">No challenge available today</div>
                </div>
            </DailyChallengeLayout>
        );
    }

    return (
        <DailyChallengeLayout 
            size={size} 
            showAbout={showAbout} 
            onShowAbout={() => setShowAbout(true)} 
            onCloseAbout={() => setShowAbout(false)} 
            dailyChallengeMode
            onToggleHistory={() => setShowHistory(!showHistory)}
            onShowTips={() => setShowTips(true)}
        >
            <GameTitle prefix="Off" />
            
            {showTips && <ColorWheelTips onDismiss={handleCloseTips} />}
            
            {showHistory ? (
                <div className="status-bar">
                    <DailyChallengeHistory userId={getUserId()} />
                </div>
            ) : showLeaderboard ? (
                <>
                    <DailyChallengeResults />
                    <div className="game-controls results-actions">
                        <Button onClick={() => navigate('/')} variant="exit">
                            Home
                        </Button>
                        <Button onClick={() => setShowLeaderboard(false)} variant="primary">
                            Results
                        </Button>
                    </div>
                </>
            ) : userSubmission ? (
                <>
                    <div className="status-bar">
                        <DailyChallengeReveal />
                    </div>
                    <DailyChallengeManager 
                        onShowAbout={() => setShowAbout(true)}
                        onShowLeaderboard={() => setShowLeaderboard(true)}
                    />
                </>
            ) : (
                <>
                    <DailyChallengeDisplay />
                    <DailyChallengeManager 
                        onShowAbout={() => setShowAbout(true)}
                        onShowTips={() => setShowTips(true)}
                    />
                </>
            )}
        </DailyChallengeLayout>
    );
};
