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
  // SVG string rendered inline — avoids Canvas API so Brave's fingerprinting
  // protection cannot corrupt the QR code image.
  const [qrCodeSvg, setQrCodeSvg] = useState<string>('');
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (gameState?.gameId) {
      const joinUrl = `https://rgb.mcteamster.com/${gameState.gameId}`;
      // Use SVG output instead of toDataURL (Canvas-based PNG).
      // Brave browser applies pixel noise to Canvas output as anti-fingerprinting,
      // which can corrupt QR codes and make them unreadable by a camera.
      QRCode.toString(joinUrl, { type: 'svg', width: 200, margin: 2 })
        .then(svg => setQrCodeSvg(svg))
        .catch(err => console.error('QR code generation failed:', err));
    }
  }, [gameState?.gameId]);

  const shareUrl = async () => {
    if (!gameState?.gameId) return;
    const joinUrl = `https://rgb.mcteamster.com/${gameState.gameId}`;

    // Web Share API — native share sheet on mobile (Android, iOS).
    // More reliable than clipboard on Brave Android and other mobile browsers.
    if (navigator.share) {
      try {
        await navigator.share({ url: joinUrl, title: 'Join my game on the Spectrum!' });
        return;
      } catch (err) {
        // User cancelled share — don't fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
        console.error('Share failed:', err);
      }
    }

    // Clipboard API (desktop / browsers without Share API)
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

    // Legacy execCommand fallback
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

  if (!isVisible || !gameState) return null;

  const hasShareApi = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="room-menu">
      <div className="room-menu-content">
        <button
          onClick={onClose}
          className="close-button"
        >
          ✕
        </button>
        {qrCodeSvg && (
          <div
            className="qr-code"
            dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
            aria-label="QR Code to join game"
          />
        )}
        <div
          className="url-copy-section"
          onClick={shareUrl}
        >
          <span className="copy-icon">
            {urlCopied ? '✅' : hasShareApi ? '🔗' : '📋'}
          </span>
          <span className="url-text">
            {urlCopied ? 'Copied!' : `https://rgb.mcteamster.com/${gameState.gameId}`}
          </span>
        </div>
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
        </div>
      </div>
    </div>
  );
};
