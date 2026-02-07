import React, { useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { getUserName } from '../../utils/userId';
import { ColorSliders } from '../ColorSliders';
import { Button } from '../Button';
import { ColorBox } from '../ColorBox';

export const DailyChallengeSubmission: React.FC = () => {
    const { currentChallenge, submitColor, error } = useDailyChallenge();
    const { selectedColor } = useColor();
    const [userName, setLocalUserName] = useState(getUserName());
    const [confirming, setConfirming] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!currentChallenge) return null;

    const handleSubmit = async () => {
        if (!userName.trim()) {
            alert('Please enter your name');
            return;
        }

        setIsSubmitting(true);
        try {
            await submitColor(selectedColor, userName.trim());
        } catch (error) {
            setIsSubmitting(false);
            setConfirming(false);
        }
    };

    const formatTimeRemaining = (validUntil: string) => {
        const now = new Date();
        const end = new Date(validUntil);
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m remaining`;
    };

    return (
        <>
            {/* Prompt in status bar area */}
            <div className="status-bar daily-challenge-status">
                <div className="prompt-card">
                    <p className="prompt">"{currentChallenge.prompt}"</p>
                    <p className="timer">{formatTimeRemaining(currentChallenge.validUntil)}</p>
                    <p className="submissions-count">
                        {currentChallenge.totalSubmissions} {currentChallenge.totalSubmissions === 1 ? 'submission' : 'submissions'} so far
                    </p>
                </div>
            </div>

            {/* Submission form in sidebar area */}
            <div className="daily-challenge-sidebar">
                <ColorSliders />
                
                <div className="submission-form">
                    <input
                        type="text"
                        placeholder="Your name (optional)"
                        value={userName}
                        onChange={(e) => setLocalUserName(e.target.value)}
                        maxLength={20}
                        className="name-input"
                        disabled={isSubmitting}
                    />

                    {!confirming ? (
                        <Button
                            onClick={() => setConfirming(true)}
                            disabled={isSubmitting}
                            variant="primary"
                        >
                            Submit Color
                        </Button>
                    ) : (
                        <div className="confirmation-dialog">
                            <p>Submit this color?</p>
                            <ColorBox color={selectedColor} width="150px" height="50px" />
                            <div className="confirmation-buttons">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    variant="primary"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Confirm'}
                                </Button>
                                <Button
                                    onClick={() => setConfirming(false)}
                                    disabled={isSubmitting}
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        </>
    );
};
