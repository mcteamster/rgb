import React, { useEffect, useState } from 'react';
import { GameTitle } from './GameTitle';
import { GameManager } from './GameManager';
import { GameDisplay } from './GameDisplay';
import { RoundReveal } from './RoundReveal';
import { GameResults } from './GameResults';
import { Button } from './Button';
import { DailyChallengeLayout } from './DailyChallengeLayout';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { useColor } from '../contexts/ColorContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useLeaderboardLoader } from '../hooks/useLeaderboardLoader';
import { setBodyBackground } from '../utils/colorUtils';

export const DailyChallenge: React.FC = () => {
    const { selectedColor } = useColor();
    const { currentChallenge, userSubmission, loadCurrentChallenge, isLoading, loadLeaderboard } = useDailyChallenge();
    const [showAbout, setShowAbout] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const size = useWindowSize();

    useLeaderboardLoader(showLeaderboard, currentChallenge?.challengeId, loadLeaderboard);

    useEffect(() => {
        loadCurrentChallenge();
    }, []);

    useEffect(() => {
        setBodyBackground(selectedColor);
    }, [selectedColor]);

    if (isLoading) {
        return (
            <DailyChallengeLayout size={size} showAbout={showAbout} onShowAbout={() => setShowAbout(true)} onCloseAbout={() => setShowAbout(false)}>
                <div className="status-bar">
                    <div className="loading-message">Loading today's challenge...</div>
                </div>
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
        <DailyChallengeLayout size={size} showAbout={showAbout} onShowAbout={() => setShowAbout(true)} onCloseAbout={() => setShowAbout(false)} dailyChallengeMode>
            <GameTitle prefix="Off" />
            
            {showLeaderboard ? (
                <>
                    <GameResults dailyChallengeMode skipLoad />
                    <div className="game-controls">
                        <Button onClick={() => setShowLeaderboard(false)} variant="back" style={{ width: '100%' }}>
                            Back to Results
                        </Button>
                    </div>
                </>
            ) : userSubmission ? (
                <>
                    <div className="status-bar">
                        <RoundReveal dailyChallengeMode />
                    </div>
                    <GameManager 
                        onShowAbout={() => setShowAbout(true)}
                        dailyChallengeMode
                        onShowLeaderboard={() => setShowLeaderboard(true)}
                    />
                </>
            ) : (
                <>
                    <GameDisplay dailyChallengeMode />
                    <GameManager 
                        onShowAbout={() => setShowAbout(true)}
                        dailyChallengeMode
                    />
                </>
            )}
        </DailyChallengeLayout>
    );
};
