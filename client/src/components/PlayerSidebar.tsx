import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useColor } from '../contexts/ColorContext';
import { useIsHost } from '../hooks/useIsHost';

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
      <div className="room-menu player-sidebar-expanded">
        <div className="room-menu-content">
          <button
            onClick={onToggle}
            className="close-button"
          >
            ✕
          </button>
          
          <div className="player-list">
            {playerScores.map((player: any) => {
              const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
              const isDescriber = currentRound?.describerId === player.playerId;
              const color = player.playerId === playerId ? selectedColor : player.draftColor;
              
              return (
                <div
                  key={player.playerId}
                  className={`player-card ${isDescriber ? 'describer' : 'default'}`}
                  style={{
                    backgroundColor: isDescriber ? undefined : (color ? `hsl(${color.h}, ${color.s}%, ${color.l}%)` : undefined),
                    color: isDescriber ? undefined : (color ? (color.l > 50 ? '#000' : '#fff') : undefined)
                  }}
                >
                  <div className="player-info">
                    <span>
                      {isDescriber ? '📣 ' : ''}
                      {player.playerName}
                      {player.playerId === playerId && ' 👤'}
                      {player.playerId === hostPlayer.playerId ? ' ⭐' : ''}
                    </span>
                  </div>
                  <div className="player-score" style={{ color: 'inherit' }}>
                    {player.totalScore}
                  </div>
                  {isHost && player.playerId !== playerId && (
                    <button
                      className="kick-button"
                      onClick={() => kickPlayer(player.playerId)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

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
              value={gameState.config?.descriptionTimeLimit === 86400 ? '-' : `${gameState.config?.descriptionTimeLimit}s`} 
            />
            <StatBox 
              label="Guesses" 
              value={gameState.config?.guessingTimeLimit === 86400 ? '-' : `${gameState.config?.guessingTimeLimit}s`} 
            />
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
      <div className="player-tab-container">
        {playerScores.map((player: any) => {
          const currentRound = gameState.meta?.currentRound != null ? gameState.gameplay?.rounds?.[gameState.meta.currentRound] : null;
          const isDescriber = currentRound?.describerId === player.playerId;
          const color = player.playerId === playerId ? selectedColor : player.draftColor;
          
          return (
            <div key={player.playerId} className="player-tab">
              <span 
                className={`player-tab-item ${isDescriber ? 'describer' : ''} ${player.playerId === playerId ? 'current-player' : ''}`}
                style={{ 
                  color: isDescriber ? undefined : (color ? (color.l > 50 ? '#000' : '#fff') : '#495057'),
                  backgroundColor: isDescriber ? undefined : (color ? `hsl(${color.h}, ${color.s}%, ${color.l}%)` : 'transparent'),
                  width: isDescriber ? '48px' : '100%',
                  height: isDescriber ? '50px' : '40px'
                }}
              >
                <div>
                  {player.playerName.substring(0, 4)}
                  {player.playerName.length > 4 ? '.' : ''}
                  {isDescriber ? ' 📣' : ''}
                </div>
                <div className="player-tab-name">
                  {player.totalScore}
                </div>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
