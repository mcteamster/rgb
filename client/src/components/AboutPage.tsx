import React, { useState } from 'react';
import { Button } from './Button';
import { discordSdk } from '../services/discord';

interface AboutPageProps {
  onClose: () => void;
  isRoute?: boolean;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onClose, isRoute = false }) => {
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

  return (
    <div className="about-page">
      <div className="about-content">
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
            Tutorial
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
              <h4>🎯 Game Setup</h4>
              <p>• Create or Join a room (2-10 players)</p>
              <p>• Set time limits for clues and guesses</p>
              <p>• Adjust the number of turns for game length</p>
              
              <h4>📝 Clue Giving</h4>
              <p>• You get a mystery color to describe</p>
              <p>• Write a clue in 50 characters or less</p>
              <p>• Be creative! Use color names, objects, emotions, or emojis</p>
              <p>• Submit your clue before time runs out</p>
              
              <h4>🎨 Color Guessing</h4>
              <p>• Read the describer's clue carefully</p>
              <p>• Use the color wheel to pick your best guess</p>
              <p>• Adjust the Hue, Saturation, and Lightness</p>
              <p>• Lock in! (or wait for time to run out)</p>
              
              <h4>🏆 Scoring</h4>
              <p>• Closer guesses = more points (up to 100)</p>
              <p>• Describer gets the average of all scores</p>
              <p>• Highest total score after all rounds wins!</p>

              <p><em>Inspired by "Hues and Cues" by Scott Brady.</em></p>
            </div>
          )}
          
          {activeTab === 'privacy' && (
            <div className="privacy-content">
              <h4>What We Collect</h4>
              <ul>
                <li>Display names you choose each game</li>
                <li>Your color descriptions and guesses</li>
                <li>Game scores and basic connection info</li>
                <li>Usage analytics via Microsoft Clarity</li>
              </ul>

              <h4>What We DON'T Collect</h4>
              <ul>
                <li>No personal info (email, phone, address)</li>
                <li>No accounts or registration required</li>
                <li>No tracking between sessions</li>
              </ul>

              <h4>How We Use It</h4>
              <ul>
                <li>Enable multiplayer gameplay</li>
                <li>Calculate scores and prevent cheating</li>
                <li>Keep the game running smoothly</li>
              </ul>

              <h4>Data Storage</h4>
              <ul>
                <li>Game data deleted when sessions end</li>
                <li>All data encrypted and secured</li>
              </ul>

              <h4>Sharing</h4>
              <p>Other players see your display name, descriptions, and scores during games. We don't sell or share your data with anyone else.</p>

              <h4>Your Control</h4>
              <p>Playing is voluntary. Leave anytime. Choose any display name. No permanent data stored about you.</p>

              <p><em>Updated January 7, 2026.</em></p>
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
        
        <Button onClick={onClose} variant="primary">{isRoute ? 'Play' : 'Close'}</Button>
      </div>
    </div>
  );
};
