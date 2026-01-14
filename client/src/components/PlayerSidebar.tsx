import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useColor } from '../contexts/ColorContext';
import { useIsHost } from '../hooks/useIsHost';
import { Button } from './Button';

const StatBox = ({ label, value }: { label: string; value: string | number }) => (
  <div className="stat-box">
    <div className="stat-box-label">{label}</div>
    <div className="stat-box-value">{value}</div>
  </div>
);

interface PlayerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenAbout: () => void;
}

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({ isOpen, onToggle }) => {
  const { gameState, playerId, kickPlayer, getCurrentRound } = useGame();
  const { selectedColor } = useColor();

  const currentRound = getCurrentRound();
  const isEndgame = currentRound?.phase === 'endgame';
  const isReveal = currentRound?.phase === 'reveal';

  if (!gameState) return null;

  const players = gameState.players || [];
  const rounds = gameState.gameplay?.rounds || [];

  // Calculate total rounds needed based on current players and their remaining turns
  const calculateTotalRounds = () => {
    const turnsPerPlayer = gameState.config?.turnsPerPlayer || 1;
    const currentRoundIndex = gameState.meta?.currentRound || 0;
    
    // Count how many turns each current player has already had
    const playerTurnCounts: Record<string, number> = {};
    players.forEach(player => {
      playerTurnCounts[player.playerId] = 0;
    });
    
    // Count completed turns from existing rounds
    rounds.slice(0, currentRoundIndex + 1).forEach(round => {
      if (round.describerId && playerTurnCounts.hasOwnProperty(round.describerId)) {
        playerTurnCounts[round.describerId]++;
      }
    });
    
    // Calculate remaining turns needed
    let remainingTurns = 0;
    players.forEach(player => {
      const turnsCompleted = playerTurnCounts[player.playerId] || 0;
      const turnsRemaining = Math.max(0, turnsPerPlayer - turnsCompleted);
      remainingTurns += turnsRemaining;
    });
    
    return rounds.length + remainingTurns;
  };

  const totalRounds = gameState.meta?.status === 'playing' ? calculateTotalRounds() : players.length * (gameState.config?.turnsPerPlayer || 1);

  // Calculate scores for each player
  const playerScores = players.map((player: any) => {
    let totalScore = 0;
    rounds.forEach((round: any) => {
      if (round.scores && round.scores[player.playerId]) {
        totalScore += round.scores[player.playerId];
      }
    });
    return {
      ...player,
      totalScore
    };
  });

  const isHost = useIsHost();
  const hostPlayer = players.reduce((earliest, player) => 
    new Date(player.joinedAt) < new Date(earliest.joinedAt) ? player : earliest
  );

  // Full view
  if (isOpen) {
    return (
      <div className="room-menu" style={{ left: '20px', right: 'auto', zIndex: 50 }}>
        <div className="room-menu-content">
          <div className="stat-boxes-container">
            <StatBox 
              label="Players" 
              value={gameState.meta?.status === 'waiting' ? `${players.length}/${gameState.config?.maxPlayers || 10}` : players.length} 
            />
            <StatBox 
              label="Rounds" 
              value={gameState.meta?.status === 'playing' ? `${(gameState.meta?.currentRound || 0) + 1}/${totalRounds}` : totalRounds} 
            />
            <StatBox 
              label="Clues" 
              value={gameState.config?.descriptionTimeLimit === 86400 ? 'Unlimited' : `${gameState.config?.descriptionTimeLimit}s`} 
            />
            <StatBox 
              label="Guesses" 
              value={gameState.config?.guessingTimeLimit === 86400 ? 'Unlimited' : `${gameState.config?.guessingTimeLimit}s`} 
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            {playerScores.map((player: any) => (
              <div
                key={player.playerId}
                className="color-accurate"
                style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.75rem',
                  minHeight: '45px',
                  backgroundColor: (() => {
                    const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                    const isDescriber = currentRound?.describerId === player.playerId;
                    
                    if (isDescriber) return '#e9ecef';
                    
                    if (player.draftColor) {
                      return `hsl(${player.draftColor.h}, ${player.draftColor.s}%, ${player.draftColor.l}%)`;
                    }
                    
                    return '#f8f9fa';
                  })(),
                  color: (() => {
                    const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                    const isDescriber = currentRound?.describerId === player.playerId;
                    
                    if (isDescriber) return '#495057';
                    
                    if (player.draftColor) {
                      return player.draftColor.l > 50 ? '#000' : '#fff';
                    }
                    
                    return '#495057';
                  })(),
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}
              >
                <div className="player-info">
                  <span>
                    {(() => {
                      const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                      return currentRound?.describerId === player.playerId ? '📣 ' : '';
                    })()}
                    {player.playerName}
                    {player.playerId === playerId && ' 👤'}
                    {player.playerId === hostPlayer.playerId ? ' ⭐' : ''}
                  </span>
                </div>
                <div style={{ fontWeight: 'bold', color: 'inherit', minWidth: '60px', textAlign: 'right' }}>
                  {player.totalScore}
                </div>
                {isHost && player.playerId !== playerId && (
                  <button
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: 'rgba(255, 0, 0, 0.8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1
                    }}
                    onClick={() => {
                      kickPlayer(player.playerId);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="menu-buttons">
            <div className="menu-buttons-row">
              <Button onClick={onToggle} variant="primary">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Minimized sidebar view (default)
  if (isEndgame || isReveal) {
    return null;
  }
  
  return (
    <div className="player-view-sidebar" onClick={() => onToggle()}>
      {playerScores.map((player: any) => (
        <div key={player.playerId} className="player-tab">
          <span 
            className="color-accurate"
            style={{ 
              color: (() => {
                // Check if this player is the current describer
                const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                const isDescriber = currentRound?.describerId === player.playerId;
                
                if (isDescriber) return '#495057'; // Dark grey text on light grey background
                
                const color = player.playerId === playerId ? selectedColor : player.draftColor;
                if (!color) return '#495057';
                const lightness = color.l;
                return lightness > 50 ? '#000' : '#fff';
              })(),
              backgroundColor: (() => {
                // Check if this player is the current describer
                const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                const isDescriber = currentRound?.describerId === player.playerId;
                
                if (isDescriber) return '#e9ecef'; // Light grey background for describer
                
                const color = player.playerId === playerId ? selectedColor : player.draftColor;
                if (!color) return 'transparent';
                const h = color.h;
                const s = color.s;
                const l = color.l;
                return `hsl(${h}, ${s}%, ${l}%)`;
              })(),
              width: (() => {
                const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                const isDescriber = currentRound?.describerId === player.playerId;
                return isDescriber ? '48px' : '100%';
              })(),
              height: (() => {
                const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                const isDescriber = currentRound?.describerId === player.playerId;
                return isDescriber ? '50px' : '40px';
              })(),
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.55rem',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: player.playerId === playerId ? 'inset 0 0 0 2px white' : 'none',
              borderLeft: player.playerId === playerId ? 'none' : 'none',
            }}
          >
            <div>
              {player.playerName.substring(0, 4)}
              {player.playerName.length > 4 ? '.' : ''}
              {(() => {
                const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
                const isDescriber = currentRound?.describerId === player.playerId;
                return isDescriber ? ' 📣' : '';
              })()}
            </div>
            <div style={{ fontSize: '0.7rem' }}>
              {player.totalScore}
            </div>
          </span>
        </div>
      ))}
    </div>
  );
};
