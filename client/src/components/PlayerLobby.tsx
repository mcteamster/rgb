import React, { useState, useEffect } from 'react';
import { useGame, loadSession } from '../contexts/GameContext';
import { Button } from './Button';
import { RegionSelector } from './RegionSelector';
import { Notification } from './Notices';

type LobbyStep = 'choose' | 'create' | 'join';

interface PlayerLobbyProps {
  roomCode?: string;
}

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({ roomCode }) => {
  const { createGame, joinGame, error, clearError, savedPlayerName, currentRegion, setRegion } = useGame();
  const [step, setStep] = useState<LobbyStep>(() => {
    // If there's a valid room code or stored session, go to join form
    if (roomCode && /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(roomCode)) {
      return 'join';
    }
    // Check for stored session
    const session = loadSession();
    if (session?.gameId) {
      return 'join';
    }
    return 'choose';
  });
  const [gameId, setGameId] = useState(() => {
    if (roomCode && /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(roomCode)) {
      return roomCode;
    }
    // Check for stored session and use that gameId
    const session = loadSession();
    return session?.gameId || '';
  });
  const [playerName, setPlayerName] = useState(savedPlayerName);
  const [isLoading, setIsLoading] = useState(false);

  // Game configuration state
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [descriptionTimeLimit, setDescriptionTimeLimit] = useState(30);
  const [guessingTimeLimit, setGuessingTimeLimit] = useState(15);
  const [turnsPerPlayer, setTurnsPerPlayer] = useState(2);

  // Direct handler for number inputs
  const handleNumberChange = (setter: (value: number) => void, newValue: number) => {
    setter(newValue);
  };

  // Sync playerName with savedPlayerName when it changes
  useEffect(() => {
    setPlayerName(savedPlayerName);
  }, [savedPlayerName]);

  // Update gameId and step when roomCode changes (for Discord auto-join)
  useEffect(() => {
    if (roomCode && /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(roomCode)) {
      setGameId(roomCode);
      setStep('join');
    }
  }, [roomCode]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsLoading(true);
    await createGame(playerName.trim(), {
      maxPlayers,
      descriptionTimeLimit,
      guessingTimeLimit,
      turnsPerPlayer
    });
    setIsLoading(false);
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId.trim() || !playerName.trim()) return;

    setIsLoading(true);
    await joinGame(gameId.trim().toUpperCase(), playerName.trim());
    setIsLoading(false);
  };

  return (
    <div className="join-controls">
      <Notification region={currentRegion} errors={error} onClearError={clearError} />

      {step === 'choose' && (
        <div className="lobby-actions">
          <Button onClick={() => setStep('create')} variant="create" disabled={isLoading}>
            Create
          </Button>
          <Button onClick={() => setStep('join')} variant="join" disabled={isLoading}>
            Join
          </Button>
        </div>
      )}

      {step === 'create' && (
        <div className="create-game-form">
          <form onSubmit={handleCreateGame}>
            <div className="config-group">
              <label>Player Name</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={16}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="config-section">

              <div className="config-group">
                <label>Clue Time</label>
                <div className="button-group">
                  {[15, 30, 45, 60, 120].map(time => (
                    <button
                      key={time}
                      type="button"
                      className={descriptionTimeLimit === time ? 'active' : ''}
                      onClick={() => setDescriptionTimeLimit(time)}
                      disabled={isLoading}
                    >
                      {time}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={descriptionTimeLimit === 86400 ? 'active' : ''}
                    onClick={() => setDescriptionTimeLimit(86400)}
                    disabled={isLoading}
                  >
                    OFF
                  </button>
                </div>
              </div>

              <div className="config-group">
                <label>Guess Time</label>
                <div className="button-group">
                  {[10, 15, 20, 30, 60].map(time => (
                    <button
                      key={time}
                      type="button"
                      className={guessingTimeLimit === time ? 'active' : ''}
                      onClick={() => setGuessingTimeLimit(time)}
                      disabled={isLoading}
                    >
                      {time}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={guessingTimeLimit === 86400 ? 'active' : ''}
                    onClick={() => setGuessingTimeLimit(86400)}
                    disabled={isLoading}
                  >
                    OFF
                  </button>
                </div>
              </div>


              <div className="config-group">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <label>Max Players</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => handleNumberChange(setMaxPlayers, Math.max(2, maxPlayers - 1))}
                        disabled={isLoading || maxPlayers <= 2}
                      >
                        -
                      </button>
                      <span className="number-value">{maxPlayers}</span>
                      <button
                        type="button"
                        onClick={() => handleNumberChange(setMaxPlayers, Math.min(10, maxPlayers + 1))}
                        disabled={isLoading || maxPlayers >= 10}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <label>Clue Turns</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => handleNumberChange(setTurnsPerPlayer, Math.max(1, turnsPerPlayer - 1))}
                        disabled={isLoading || turnsPerPlayer <= 1}
                      >
                        -
                      </button>
                      <span className="number-value">{turnsPerPlayer}</span>
                      <button
                        type="button"
                        onClick={() => handleNumberChange(setTurnsPerPlayer, Math.min(5, turnsPerPlayer + 1))}
                        disabled={isLoading || turnsPerPlayer >= 5}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="config-summary" style={{
              backgroundColor: '#f8f9fa',
              padding: '1rem',
              borderRadius: '6px',
              fontSize: '0.9rem',
              color: '#495057',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                Up to <strong>{maxPlayers * turnsPerPlayer} rounds </strong>
                <br></br>
                Est. {Math.ceil((maxPlayers * turnsPerPlayer * ((descriptionTimeLimit === 86400 ? 60 : descriptionTimeLimit) + (guessingTimeLimit === 86400 ? 30 : guessingTimeLimit))) / 60)} minutes
              </div>

              <RegionSelector
                currentRegion={currentRegion}
                onRegionChange={setRegion}
              />
            </div>

            <div className="form-buttons">
              <Button onClick={() => setStep('choose')} variant="back" disabled={isLoading}>
                Back
              </Button>
              <Button type="submit" variant="create" disabled={isLoading || !playerName.trim()}>
                {isLoading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </div >
      )}


      {
        step === 'join' && (
          <div className="join-game-form">
            <form onSubmit={handleJoinGame}>
              <div className="config-group">
                <label>Player Name</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={16}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <div className="config-group">
                <label>Room Code</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔑</span>
                  <input
                    type="text"
                    placeholder="Enter 4-letter code"
                    value={gameId}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^BCDFGHJKLMNPQRSTVWXZ]/gi, '').toUpperCase();
                      setGameId(value);
                    }}
                    maxLength={4}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <div className="form-buttons">
                <Button onClick={() => setStep('choose')} variant="back" disabled={isLoading}>
                  Back
                </Button>
                <Button type="submit" variant="join" disabled={isLoading || gameId.length !== 4 || !playerName.trim()}>
                  {isLoading ? 'Joining...' : 'Join'}
                </Button>
              </div>
            </form>
          </div>
        )
      }
    </div >
  );
};
