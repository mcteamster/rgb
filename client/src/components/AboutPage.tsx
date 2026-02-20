import React, { useState } from 'react';
import { discordSdk } from '../services/discord';

interface AboutPageProps {
  onClose: () => void;
  onShowTips?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onClose, onShowTips }) => {
  const [activeTab, setActiveTab] = useState<'description' | 'privacy' | 'terms'>('description');
  const isInDiscord = !!discordSdk;

  const handleMcteamsterClick = () => {
    if (discordSdk) {
      discordSdk.commands.openExternalLink({ url: 'https://mcteamster.com' });
    } else {
      window.open('https://mcteamster.com', '_blank');
    }
  };

  const handleDiscordClick = () => {
    window.open('https://discord.com/discovery/applications/1458048532639514800', '_blank');
  };

  const handleHuesAndCuesClick = () => {
    if (discordSdk) {
      discordSdk.commands.openExternalLink({ url: 'https://boardgamegeek.com/boardgame/302520/hues-and-cues' });
    } else {
      window.open('https://boardgamegeek.com/boardgame/302520/hues-and-cues', '_blank');
    }
  };

  return (
    <div className="about-page">
      <div className="about-content">
        <button
          onClick={onClose}
          className="close-button"
        >
          ✕
        </button>
        <h1>On the Spectrum</h1>
        <p className="subtitle">
          a game by <span onClick={handleMcteamsterClick} className="link">mcteamster</span>
          {!isInDiscord && (
            <> • play on <span onClick={handleDiscordClick} className="link">Discord</span></>
          )}
        </p>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'description' ? 'active' : ''}`}
            onClick={() => setActiveTab('description')}
          >
            About
          </button>
          <button
            className={`tab ${activeTab === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            Terms
          </button>
          <button
            className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'description' && (
            <div className="overview-content">
              <h4>How to Play</h4>
              <p>Try to guess the color that matches the prompt. The closer your guess the better your score!</p>

              <h4>Multiplayer</h4>
              <p>Create a game, share the code, and take turns giving clues. Highest score wins.</p>

              <h4>Daily Challenge</h4>
              <p>Everybody gets the same prompt each day. Test how close you are to the community average!</p>

              {onShowTips && (
                <button 
                  onClick={() => {
                    onClose();
                    onShowTips();
                  }}
                  className="tips-dismiss-btn"
                >
                  Show Tutorial
                </button>
              )}

              <p style={{ marginTop: onShowTips ? '16px' : '0' }}><em>Inspired by <span onClick={handleHuesAndCuesClick} className="link">Hues and Cues</span> by Scott Brady.</em></p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="privacy-content">
              <h4>What We Collect</h4>
              <ul>
                <li>Display names you choose each game</li>
                <li>Your color descriptions and guesses</li>
                <li>Game scores and basic connection info</li>
                <li>Daily challenge submissions (colors and scores)</li>
                <li>Anonymous user ID (stored locally) for daily challenge history</li>
                <li>Browser fingerprint for duplicate submission prevention</li>
                <li>Usage analytics via Microsoft Clarity</li>
              </ul>

              <h4>What We DON'T Collect</h4>
              <ul>
                <li>No personal info (email, phone, address)</li>
                <li>No accounts or registration required</li>
                <li>No real names or identifiable information</li>
              </ul>

              <h4>How We Use It</h4>
              <ul>
                <li>Enable multiplayer gameplay</li>
                <li>Calculate scores and prevent cheating</li>
                <li>Generate daily challenge statistics and averages</li>
                <li>Track your personal daily challenge history (30 days)</li>
                <li>Keep the game running smoothly</li>
              </ul>

              <h4>Data Storage</h4>
              <ul>
                <li>Multiplayer game data deleted when sessions end</li>
                <li>Daily challenge submissions stored for 30 days</li>
                <li>Aggregate statistics (averages, standard deviations) stored permanently</li>
                <li>Anonymous user ID stored in your browser's local storage</li>
              </ul>

              <h4>Sharing</h4>
              <p>Other players see your display name, descriptions, and scores during games. Daily challenge statistics (averages, standard deviations) are publicly visible but not linked to individual players. Your personal submission history is only visible to you. We don't sell or share your data with anyone else.</p>

              <h4>Your Control</h4>
              <p>Playing is voluntary. Leave anytime. Choose any display name. Clear your browser data to reset your daily challenge history.</p>

              <p><em>Updated February 20, 2026.</em></p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="terms-content">
              <h4>Game Rules</h4>
              <ul>
                <li>Be respectful to other players</li>
                <li>Don't cheat or use automated tools</li>
                <li>Keep descriptions appropriate</li>
                <li>Follow rate limits (no spam)</li>
              </ul>

              <h4>Service</h4>
              <ul>
                <li>Game provided "as is" - no warranties</li>
                <li>May be unavailable for maintenance</li>
                <li>We can modify or stop the service anytime</li>
              </ul>

              <h4>Your Responsibilities</h4>
              <ul>
                <li>Use a compatible browser</li>
                <li>Don't try to hack or break the game</li>
                <li>Report bugs responsibly</li>
              </ul>

              <h4>Liability</h4>
              <p>This game is provided for entertainment only. We are not liable for any damages, issues, disputes, or problems arising from use of this service.</p>

              <p><em>Updated January 7, 2026.</em></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
