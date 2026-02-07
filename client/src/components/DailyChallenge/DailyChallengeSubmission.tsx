import React, { useState } from 'react';
import { useDailyChallenge } from '../../contexts/DailyChallengeContext';
import { useColor } from '../../contexts/ColorContext';
import { getUserName } from '../../utils/userId';
import { ColorSliders } from '../ColorSliders';
import { Button } from '../Button';
import { ColorBox } from '../ColorBox';

export const DailyChallengeSubmission: React.FC = () => {
    const { currentChallenge, submitColor, error } = useDailyChallenge();
    const { selectedColor, showSliders, setShowSliders } = useColor();
    const [userName] = useState(getUserName());
    const [confirming, setConfirming] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!currentChallenge) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await submitColor(selectedColor, userName);
        } catch (error) {
            setIsSubmitting(false);
            setConfirming(false);
        }
    };

    const buttonColor = `hsl(${Math.round(selectedColor.h)}, ${Math.round(selectedColor.s)}%, ${Math.round(selectedColor.l)}%)`;
    const textColor = selectedColor.l > 50 ? '#000' : '#fff';

    return (
        <div className="daily-challenge-form">
            {showSliders && <ColorSliders />}

            {!confirming ? (
                <div className="guess-controls-container">
                    <div 
                        className="color-preview-square"
                        onClick={() => setShowSliders(!showSliders)}
                        style={{ backgroundColor: buttonColor }}
                    >
                        ✏️
                    </div>
                    <Button
                        onClick={() => setConfirming(true)}
                        disabled={isSubmitting}
                        style={{ 
                            background: buttonColor,
                            color: textColor,
                            fontWeight: 'bold',
                            border: '2px solid #888',
                            flex: 1
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            Submit Color
                            <span>✅</span>
                        </div>
                    </Button>
                </div>
            ) : (
                <div className="confirmation-dialog">
                    <p>Submit this color?</p>
                    <ColorBox color={selectedColor} width="150px" height="50px" />
                    <div className="confirmation-buttons">
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            style={{ 
                                background: buttonColor,
                                color: textColor,
                                fontWeight: 'bold',
                                border: '2px solid #888'
                            }}
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
    );
};
