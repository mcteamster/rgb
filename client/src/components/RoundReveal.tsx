import React, { useState, useEffect } from 'react';
import { ColorBox } from './ColorBox';
import { GameRound, Player } from '../types/game';
import { usePlayerRankings } from '../hooks/usePlayerRankings';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { getOrdinalSuffix } from '../utils/formatUtils';

interface RoundRevealProps {
  currentRound?: GameRound;
  players?: Player[];
  dailyChallengeMode?: boolean;
}

const AnimatedScore: React.FC<{ finalScore: number; roundScore: number }> = ({ finalScore, roundScore }) => {
  const [displayScore, setDisplayScore] = useState(finalScore - roundScore);
  
  useEffect(() => {
    const startScore = finalScore - roundScore;
    const duration = 1000; // 1 second animation
    const steps = 30;
    const increment = roundScore / steps;
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(finalScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(startScore + (increment * currentStep)));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [finalScore, roundScore]);
  
  return <span>{displayScore}</span>;
};

export const RoundReveal: React.FC<RoundRevealProps> = ({
  currentRound,
  players,
  dailyChallengeMode = false
}) => {
  const { currentChallenge, userSubmission } = useDailyChallenge();
  const playerRankings = players ? usePlayerRankings(players) : {};

  // Daily challenge results
  if (dailyChallengeMode && currentChallenge && userSubmission) {
    return (
      <div className="reveal-phase" style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <div className="result-card">
          <div className="prompt-card">
            <p className="prompt">"{currentChallenge.prompt}"</p>
          </div>

          <div className="score-display">
            <h1 className="score">{userSubmission.score}</h1>
            <p className="score-label">points</p>
            {userSubmission.rank && (
              <p className="rank">
                Rank: #{userSubmission.rank} of {currentChallenge.totalSubmissions}
              </p>
            )}
            {userSubmission.distanceFromAverage !== undefined && (
              <p className="distance">
                Distance: {userSubmission.distanceFromAverage.toFixed(3)}
              </p>
            )}
          </div>

          <div className="colors-comparison">
            <div className="color-block">
              <h3>Your Color</h3>
              <ColorBox color={userSubmission.color} width="150px" height="60px" />
            </div>
            {userSubmission.averageColor && (
              <div className="color-block">
                <h3>Average Color</h3>
                <ColorBox color={userSubmission.averageColor} width="150px" height="60px" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Multiplayer round reveal
  if (!currentRound || !players) return null;

  return (
    <div className="reveal-phase" style={{ textAlign: 'center', paddingBottom: '20px' }}>
      <div className="target-vs-guesses" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: '16px', padding: '16px 20px 0 20px' }}>
          {currentRound.description ? (
            <>
              <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#000', fontWeight: 'bold' }}>
                "{currentRound.description}"
              </span>
              <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#666' }}>
                {' '}was
              </span>
            </>
          ) : (
            <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#666' }}>
              No clue was given
            </span>
          )}
        </div>
        <div className="target-color" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ColorBox 
            color={currentRound.targetColor}
            fontSize="12px"
            label={players.find(p => p.playerId === currentRound.describerId)?.playerName}
          />
          <div style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>
            +{Math.round(currentRound.scores?.[currentRound.describerId || ''] || 0)}
            <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>
              <AnimatedScore 
                finalScore={players.find(p => p.playerId === currentRound.describerId)?.score || 0}
                roundScore={currentRound.scores?.[currentRound.describerId || ''] || 0}
              />{' | '}{currentRound.describerId ? playerRankings[currentRound.describerId] : 0}{currentRound.describerId ? getOrdinalSuffix(playerRankings[currentRound.describerId]) : ''}
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: '2px', backgroundColor: '#ccc', margin: '20px 0' }}></div>
        <div className="player-guesses">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', maxHeight: '400px', overflowY: 'auto', padding: '0 10px' }}>
            {currentRound.description ? (
              // Normal round - show actual guesses
              Object.entries(currentRound.submissions || {})
                .sort(([aId], [bId]) => (currentRound.scores?.[bId] || 0) - (currentRound.scores?.[aId] || 0))
                .map(([pId, color]) => {
                const player = players.find(p => p.playerId === pId);
                const score = currentRound.scores?.[pId] || 0;
                return (
                  <div key={pId} className="guess-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ColorBox 
                      color={color} 
                      label={player?.playerName}
                    />
                    <div style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>
                      +{Math.round(score)}
                      <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>
                        <AnimatedScore 
                          finalScore={player?.score || 0}
                          roundScore={score}
                        />{' | '}{playerRankings[pId]}{getOrdinalSuffix(playerRankings[pId])}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // No clue round - show all non-describers with +100
              players
                .filter(player => player.playerId !== currentRound.describerId)
                .sort((a, b) => (playerRankings[a.playerId] || 0) - (playerRankings[b.playerId] || 0))
                .map(player => (
                  <div key={player.playerId} className="guess-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '200px', 
                      height: '60px', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      backgroundColor: '#f0f0f0',
                      color: '#666'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {player.playerName}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        No guess needed
                      </div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>
                      +100
                      <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>
                        <AnimatedScore 
                          finalScore={player.score || 0}
                          roundScore={100}
                        />{' | '}{playerRankings[player.playerId]}{getOrdinalSuffix(playerRankings[player.playerId])}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
