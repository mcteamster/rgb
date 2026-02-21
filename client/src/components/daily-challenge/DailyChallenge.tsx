import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameTitle } from '../GameTitle';
import { DailyChallengeManager } from './DailyChallengeManager';
import { DailyChallengeDisplay } from './DailyChallengeDisplay';
import { DailyChallengeReveal } from './DailyChallengeReveal';
import { DailyChallengeResults } from './DailyChallengeResults';
import { DailyChallengeHistory } from './DailyChallengeHistory';
import { DailyChallengeCalendar } from './DailyChallengeCalendar';
import { Button } from '../Button';
import { DailyChallengeLayout } from './DailyChallengeLayout';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { setBodyBackground } from '../../utils/colorUtils';
import { ColorWheelTips } from '../ColorGuessingTips';
import { getUserId } from '../../utils/userId';
import { dailyChallengeApi } from '../../services/dailyChallengeApi';

const DAILY_CHALLENGE_TIPS_KEY = 'dailyChallengeTipsSeen';

export const DailyChallenge: React.FC = () => {
    const navigate = useNavigate();
    const { selectedColor, setIsColorLocked } = useColor();
    const { currentChallenge, userSubmission, loadCurrentChallenge, loadChallengeByDate, isLoading } = useDailyChallenge();
    const [showAbout, setShowAbout] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTips, setShowTips] = useState(false);
    const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
    const size = useWindowSize();

    const loadCompletedDates = useCallback(() => {
        const userId = getUserId();
        dailyChallengeApi.getUserHistory(userId, 30).then(response => {
            const dates = new Set(response.submissions.map(s => s.challengeId));
            setCompletedDates(dates);
        }).catch(console.error);
    }, []);

    useEffect(() => {
        loadCurrentChallenge();
        loadCompletedDates();
    }, [loadCompletedDates]);

    // Refresh completed dates when user submits
    useEffect(() => {
        if (userSubmission) {
            loadCompletedDates();
        }
    }, [userSubmission, loadCompletedDates]);

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

    const handleSelectDate = (date: string) => {
        loadChallengeByDate(date);
        setShowHistory(false);
        setIsColorLocked(false);
    };

    if (isLoading) {
        return (
            <DailyChallengeLayout 
                size={size} 
                showAbout={showAbout} 
                onShowAbout={() => setShowAbout(true)} 
                onCloseAbout={() => setShowAbout(false)}
                dailyChallengeMode
                onShowCalendar={() => setShowCalendar(true)}
                isLoading
                challengeDate={currentChallenge?.challengeId}
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
            onShowCalendar={() => setShowCalendar(true)}
            onShowTips={() => setShowTips(true)}
            challengeDate={currentChallenge.challengeId}
        >
            <GameTitle prefix="Off" />
            
            {showTips && <ColorWheelTips onDismiss={handleCloseTips} />}
            {showCalendar && (
                <DailyChallengeCalendar 
                    onClose={() => setShowCalendar(false)}
                    onSelectDate={handleSelectDate}
                    completedDates={completedDates}
                />
            )}
            
            {showHistory ? (
                <div className="room-menu history-sidebar-expanded">
                    <div className="room-menu-content">
                        <button
                            onClick={() => setShowHistory(false)}
                            className="close-button"
                        >
                            ×
                        </button>
                        <DailyChallengeHistory userId={getUserId()} />
                    </div>
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
