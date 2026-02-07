import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ColorProvider } from './contexts/ColorContext';
import { GameProvider } from './contexts/GameContext';
import { DailyChallengeProvider } from './contexts/DailyChallengeContext';
import { GameContainer } from './components/GameContainer';
import { AboutPage } from './components/AboutPage';
import { DailyChallengePage } from './components/DailyChallenge/DailyChallengePage';

const App: React.FC = () => {
  return (
    <Router>
      <GameProvider>
        <ColorProvider>
          <Routes>
            <Route path="/" element={<GameContainer />} />
            <Route path="/about" element={<AboutPage onClose={() => window.location.href = '/'} />} />
            <Route
              path="/daily-challenge"
              element={
                <DailyChallengeProvider>
                  <DailyChallengePage />
                </DailyChallengeProvider>
              }
            />
            <Route path="/:roomCode" element={<GameContainer />} />
          </Routes>
        </ColorProvider>
      </GameProvider>
    </Router>
  );
};

export default App;
