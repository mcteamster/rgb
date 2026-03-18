# E2E Test Specifications

Playwright smoke tests live in `e2e/tests/`. This document specifies the full set of
scenarios that should eventually be covered, organised by feature area.

---

## 1. Navigation & smoke

| # | Scenario | Notes |
|---|----------|-------|
| 1.1 | Home page loads, `<title>` contains "On the Spectrum" | Implemented |
| 1.2 | `/about` loads and displays content | Implemented |
| 1.3 | `/daily` loads without 404 | Implemented |
| 1.4 | `/:roomCode` (valid consonant code) loads the game container | Implemented |
| 1.5 | Invalid path shows fallback or redirects to `/` | Implemented |

---

## 2. Room creation

| # | Scenario | Notes |
|---|----------|-------|
| 2.1 | "Create" button is visible on home page | |
| 2.2 | Create form shows clue time, guess time, max players, turns per player controls | |
| 2.3 | Estimated game duration updates when settings change | |
| 2.4 | Clue time options: 15 s, 30 s, 45 s, 60 s, 120 s, OFF | |
| 2.5 | Guess time options: 10 s, 15 s, 20 s, 30 s, 60 s, OFF | |
| 2.6 | Max players slider range 2–10 | |
| 2.7 | Turns per player range 1–5 | |
| 2.8 | Submitting the form creates a game and shows the lobby | |
| 2.9 | Room code in lobby URL is 4 chars, consonants only | Regex: `/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/` |
| 2.10 | Session is saved to `localStorage` after creation | |

---

## 3. Room joining

| # | Scenario | Notes |
|---|----------|-------|
| 3.1 | "Join" button is visible on home page | |
| 3.2 | Join form accepts a room code and player name | |
| 3.3 | Room code field rejects non-consonant characters | |
| 3.4 | Player name max length is 16 chars | |
| 3.5 | Joining a valid room adds the player to the lobby | Requires 2 browser contexts |
| 3.6 | Joining with an invalid room code shows an error | |
| 3.7 | Joining a full room shows an error | Max players limit |
| 3.8 | Joining with a duplicate player name (in waiting) shows an error | |
| 3.9 | Navigating to `/:roomCode` pre-fills the join code | |
| 3.10 | Rejoining an active game via saved session bypasses the join form | |

---

## 4. Lobby

| # | Scenario | Notes |
|---|----------|-------|
| 4.1 | Host sees "Start Game" button | |
| 4.2 | Non-host does not see "Start Game" button | |
| 4.3 | "Start Game" is disabled with only 1 player | |
| 4.4 | "Start Game" is enabled with 2+ players | |
| 4.5 | Player list shows all connected players | |
| 4.6 | Player list updates in real-time when a second player joins | Requires 2 browser contexts |
| 4.7 | QR code is visible to the host | SVG rendered on canvas |
| 4.8 | "Copy URL" copies the room link to clipboard | |
| 4.9 | Host can kick a player in the lobby | |
| 4.10 | Kicked player is redirected to home | |
| 4.11 | "Leave Game" button is visible to non-host | |
| 4.12 | "Close Room" button is visible to host | |
| 4.13 | Closing the room removes all players | |

---

## 5. Describing phase

| # | Scenario | Notes |
|---|----------|-------|
| 5.1 | Describer sees the target colour box | Implemented |
| 5.2 | Describer sees a text input for the clue | Implemented |
| 5.3 | Clue input max length is 50 chars | Implemented |
| 5.4 | Guessers see a "waiting for describer" message | Implemented |
| 5.5 | Pressing Enter once shows a confirm prompt | Implemented — double-enter pattern |
| 5.6 | Pressing Enter twice submits the clue | Implemented |
| 5.7 | Submitted clue advances the game to guessing phase | Implemented |
| 5.8 | Countdown timer is shown when clue time is finite | Implemented |
| 5.9 | Timer expiry auto-submits the current clue draft | Implemented — 15 s clue time, 40 s timeout |
| 5.10 | Submitting an empty clue (no-clue) awards +100 to all guessers | Implemented — server-driven via timer expiry |
| 5.11 | Draft clue updates are broadcast while typing | Implemented — WebSocket frame assertion |
| 5.12 | Non-describer cannot interact with the clue input | Implemented |

---

## 6. Guessing phase

| # | Scenario | Notes |
|---|----------|-------|
| 6.1 | Guessers see the colour wheel and the clue text | |
| 6.2 | Clicking the colour wheel updates the selected colour | |
| 6.3 | HSL sliders (toggled with 🎨) update the selected colour | |
| 6.4 | Submit button locks the guess and shows "Locked In 🔒" | |
| 6.5 | Locked guess cannot be changed | |
| 6.6 | Describer sees submission count (e.g. "2/4 🔒") | |
| 6.7 | Live colour previews of other players are visible | Draft colour broadcast |
| 6.8 | Countdown timer shown when guess time is finite | |
| 6.9 | Timer expiry auto-submits the current colour selection | |
| 6.10 | All guessers submitting triggers the reveal phase | |
| 6.11 | Describer cannot submit a colour guess in this phase | |

---

## 7. Reveal phase

| # | Scenario | Notes |
|---|----------|-------|
| 7.1 | Results screen shows each player's guessed colour | Coloured square |
| 7.2 | Target colour is shown as the border of each square | |
| 7.3 | Scores are displayed for the round | |
| 7.4 | Standings list is ordered by total score | |
| 7.5 | Skipped guess shows ⏭️ emoji | |
| 7.6 | No-clue round shows ❌ emoji for describer | |
| 7.7 | "Next Round" button is disabled for 3 s (prevents mis-click) | |
| 7.8 | "Next Round" starts the next describing phase | |
| 7.9 | Button label changes to "Game Summary" when all turns are done | |
| 7.10 | Only the host can advance to the next round | |

---

## 8. Scoring

| # | Scenario | Notes |
|---|----------|-------|
| 8.1 | Exact colour match scores 100 | `h`, `s`, `l` identical to target |
| 8.2 | Colour within 1σ of all channels scores > 60 | Approximate |
| 8.3 | Colour beyond 3σ on any channel scores 0 | Hard cutoff |
| 8.4 | Describer score equals the average of guesser scores | |
| 8.5 | No-clue round: guessers score 100, describer scores 0 | |
| 8.6 | Skipped guess scores 0 | |
| 8.7 | Scores accumulate across rounds | |
| 8.8 | Hue difference is treated as circular (0° ≡ 360°) | Red wrap-around |

---

## 9. Endgame

| # | Scenario | Notes |
|---|----------|-------|
| 9.1 | Full standings shown after final round | All players, all rounds |
| 9.2 | Winner(s) displayed with 🏆 | Ties allowed |
| 9.3 | Host sees "Play Again" and "End Game" buttons | |
| 9.4 | Non-host sees neither button | |
| 9.5 | "Play Again" resets scores and returns to lobby | |
| 9.6 | "End Game" closes the room and returns all players to home | |
| 9.7 | Replay starts a new sequence with the same players | |

---

## 10. Daily challenge

| # | Scenario | Notes |
|---|----------|-------|
| 10.1 | `/daily` loads and shows today's prompt | Requires backend |
| 10.2 | Colour wheel is interactive before submission | |
| 10.3 | A confirmation dialog appears before submitting | |
| 10.4 | After submission, the user's colour vs. community average is shown | |
| 10.5 | Score and distance from average are displayed | |
| 10.6 | Submitting the same challenge a second time is rejected | Idempotency |
| 10.7 | Community stats (H/S/L mean and σ) are shown after submission | |
| 10.8 | 30-day history calendar renders | |
| 10.9 | Completed days in the calendar show the submitted colour | |
| 10.10 | Clicking an unsubmitted past day loads that challenge | ≤ 30 days |
| 10.11 | Streak counter shows 🔥 when today is already submitted | |
| 10.12 | Streak counter shows ⏳ when today is not yet submitted | |

---

## 11. Session & reconnection

| # | Scenario | Notes |
|---|----------|-------|
| 11.1 | Refreshing the page while in lobby re-joins automatically | Session in `localStorage` |
| 11.2 | Refreshing during a round reconnects and shows the correct phase | |
| 11.3 | Session expires after 12 hours and redirects to home | |
| 11.4 | Navigating to a room URL with a saved session auto-rejoins | |
| 11.5 | Navigating to a room URL without a saved session shows join form | |

---

## 12. Multiplayer edge cases

| # | Scenario | Notes |
|---|----------|-------|
| 12.1 | Host disconnect transfers host to next-oldest player | |
| 12.2 | Describer disconnect during describing nullifies the round (+100 to others) | |
| 12.3 | Describer disconnect during guessing removes them without nullifying | |
| 12.4 | Non-describer disconnect during guessing removes them; round completes | |
| 12.5 | All players except one disconnect — last player sees a graceful state | |
| 12.6 | Player rejoins mid-round and sees the correct phase | |
| 12.7 | Simultaneous colour submissions from all guessers trigger reveal once | |
| 12.8 | Two players create games at the same time — room codes are unique | |

---

## 13. Accessibility & responsiveness

| # | Scenario | Notes |
|---|----------|-------|
| 13.1 | All interactive controls are keyboard-navigable | Tab, Enter, Space |
| 13.2 | Colour wheel is operable via keyboard or sliders alone | Motor accessibility |
| 13.3 | Mobile viewport (375 × 812) — game is playable without horizontal scroll | Pixel 5 / iPhone 12 |
| 13.4 | Tablet viewport (768 × 1024) — layout adapts correctly | |
| 13.5 | Font sizes are legible at 100% zoom on desktop | |

---

## Implementation priority

| Priority | Areas |
|----------|-------|
| **High** | 2 (creation), 3 (joining), 5 (describing), 6 (guessing), 7 (reveal), 10 (daily) |
| **Medium** | 4 (lobby), 8 (scoring), 9 (endgame), 11 (session) |
| **Low** | 12 (edge cases), 13 (a11y) — best covered once core flows are stable |

Multiplayer scenarios (sections 3.5, 4.6, 12.x) require Playwright's
[browser contexts](https://playwright.dev/docs/browser-contexts) to simulate
two or more simultaneous players in a single test.
