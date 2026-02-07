import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initClarity } from './services/clarity'
import { initaliseDiscord } from './services/discord';

// Initialise Discord
if (initaliseDiscord() && (window.innerWidth / window.innerHeight < 1)) {
  document.documentElement.style.setProperty('--header-offset', '50px');
}

// Initialize Clarity
if (import.meta.env.VITE_CLARITY_PROJECT_ID) {
  initClarity(import.meta.env.VITE_CLARITY_PROJECT_ID);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
