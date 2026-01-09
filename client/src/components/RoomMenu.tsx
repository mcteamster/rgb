import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useGame } from '../contexts/GameContext';
import { useColor } from '../contexts/ColorContext';
import { Button } from './Button';

interface RoomMenuProps {
  isVisible: boolean;
  onClose: () => void;
}

export const RoomMenu: React.FC<RoomMenuProps> = ({ isVisible, onClose }) => {
  const { gameState, exitGame, resetGame, playerId, closeRoom } = useGame();
  const { setIsColorLocked } = useColor();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (gameState?.gameId) {
      const joinUrl = `https://rgb.mcteamster.com/${gameState.gameId}`;
      QRCode.toDataURL(joinUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    }
  }, [gameState?.gameId]);

  const copyUrlToClipboard = async () => {
    if (gameState?.gameId) {
      const joinUrl = `https://rgb.mcteamster.com/${gameState.gameId}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(joinUrl);
          setUrlCopied(true);
          setTimeout(() => setUrlCopied(false), 2000);
          return;
        } catch (err) {
          console.error('Clipboard API failed:', err);
        }
      }
      
      try {
        const textArea = document.createElement('textarea');
        textArea.value = joinUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      }
    }
  };

  const handleReplay = () => {
    resetGame();
    setIsColorLocked(false);
    onClose();
  };

  const handleCloseRoom = () => {
    closeRoom();
    onClose();
  };

  const handleLeaveGame = () => {
    exitGame();
    onClose();
  };

  // Determine if current player is host
  const isHost = gameState?.players && playerId ? 
    gameState.players.reduce((earliest: any, player: any) =>
      new Date(player.joinedAt) < new Date(earliest.joinedAt) ? player : earliest
    ).playerId === playerId : false;

  // Check if lobby is open (game is in waiting state)
  const isLobbyOpen = gameState?.meta?.status === 'waiting';

  if (!isVisible || !gameState) return null;

  return (
    <div className="room-menu">
      <div className="room-menu-content">
        {isLobbyOpen && (
          <div 
            className="url-copy-section"
            onClick={copyUrlToClipboard}
          >
            <span className="copy-icon">{urlCopied ? '✅' : '📋'}</span>
            <span className="url-text">
              {urlCopied ? 'Copied!' : `https://rgb.mcteamster.com/${gameState.gameId}`}
            </span>
          </div>
        )}
        {isLobbyOpen && qrCodeUrl && <img src={qrCodeUrl} alt="QR Code to join game" />}
        <div className="menu-buttons">
          <div className="menu-buttons-row">
            {isHost ? (
              <>
                <Button onClick={handleReplay} variant="exit">
                  Reset Game
                </Button>
                <Button onClick={handleCloseRoom} variant="exit">
                  Close Room
                </Button>
              </>
            ) : (
              <Button onClick={handleLeaveGame} variant="exit">
                Leave Game
              </Button>
            )}
          </div>
          <div className="menu-buttons-row">
            <Button onClick={onClose} variant="primary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
