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
| 2.1 | "Create" button is visible on home page | Implemented |
| 2.2 | Create form shows clue time, guess time, max players, turns per player controls | Implemented |
| 2.3 | Estimated game duration updates when settings change | Implemented |
| 2.4 | Clue time options: 15 s, 30 s, 45 s, 60 s, 120 s, OFF | Implemented |
| 2.5 | Guess time options: 10 s, 15 s, 20 s, 30 s, 60 s, OFF | Implemented |
| 2.6 | Max players slider range 2–10 | Implemented |
| 2.7 | Turns per player range 1–5 | Implemented |
| 2.8 | Submitting the form creates a game and shows the lobby | Implemented |
| 2.9 | Room code in lobby URL is 4 chars, consonants only | Regex: `/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/` — Implemented |
| 2.10 | Session is saved to `localStorage` after creation | Implemented |

---

## 3. Room joining

| # | Scenario | Notes |
|---|----------|-------|
| 3.1 | "Join" button is visible on home page | Implemented |
| 3.2 | Join form accepts a room code and player name | Implemented |
| 3.3 | Room code field rejects non-consonant characters | Implemented |
| 3.4 | Player name max length is 16 chars | Implemented |
| 3.5 | Joining a valid room adds the player to the lobby | Requires 2 browser contexts — Implemented |
| 3.6 | Joining with an invalid room code shows an error | Implemented |
| 3.7 | Joining a full room shows an error | Max players limit — Implemented |
| 3.8 | Joining with a duplicate player name (in waiting) shows an error | Implemented |
| 3.9 | Navigating to `/:roomCode` pre-fills the join code | Implemented |
| 3.10 | Rejoining an active game via saved session bypasses the join form | Implemented |

---

## 4. Lobby

| # | Scenario | Notes |
|---|----------|-------|
| 4.1 | Host sees "Start Game" button | Implemented |
| 4.2 | Non-host does not see "Start Game" button | Implemented |
| 4.3 | "Start Game" is disabled with only 1 player | Implemented |
| 4.4 | "Start Game" is enabled with 2+ players | Implemented |
| 4.5 | Player list shows all connected players | Implemented |
| 4.6 | Player list updates in real-time when a second player joins | Requires 2 browser contexts — Implemented |
| 4.7 | QR code is visible to the host | SVG rendered on canvas — Implemented |
| 4.8 | "Copy URL" copies the room link to clipboard | Implemented |
| 4.9 | Host can kick a player in the lobby | Implemented |
| 4.10 | Kicked player is redirected to home | Implemented |
| 4.11 | "Leave Game" button is visible to non-host | Implemented |
| 4.12 | "Close Room" button is visible to host | Implemented |
| 4.13 | Closing the room removes all players | Implemented |

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
| 6.1 | Guessers see the colour wheel and the clue text | Implemented |
| 6.2 | Clicking the colour wheel updates the selected colour | Implemented |
| 6.3 | HSL sliders (toggled with 🎨) update the selected colour | Implemented |
| 6.4 | Submit button locks the guess and shows "Locked In 🔒" | Implemented |
| 6.5 | Locked guess cannot be changed | Implemented |
| 6.6 | Describer sees submission count (e.g. "2/4 🔒") | Implemented |
| 6.7 | Live colour previews of other players are visible | Implemented — WebSocket frame assertion |
| 6.8 | Countdown timer shown when guess time is finite | Implemented |
| 6.9 | Timer expiry auto-submits the current colour selection | Implemented — 10 s guess time, 40 s timeout |
| 6.10 | All guessers submitting triggers the reveal phase | Implemented |
| 6.11 | Describer cannot submit a colour guess in this phase | Implemented |

---

## 7. Reveal phase

| # | Scenario | Notes |
|---|----------|-------|
| 7.1 | Results screen shows each player's guessed colour | Implemented |
| 7.2 | Target colour is shown in the reveal | Implemented |
| 7.3 | Scores are displayed for the round | Implemented |
| 7.4 | Standings list is ordered by total score | Not implemented — hard to assert reliably |
| 7.5 | Skipped guess shows ⏭️ emoji | Not implemented — complex to trigger |
| 7.6 | No-clue round shows "No clue was given" | Implemented — 15 s clue timer, 40 s timeout |
| 7.7 | "Next Round" button is disabled for 3 s (prevents mis-click) | Implemented |
| 7.8 | "Next Round" starts the next describing phase | Implemented |
| 7.9 | Button label changes to "Game Summary" when all turns are done | Implemented — turnsOne=true, 2 rounds, 90 s timeout |
| 7.10 | Only the host can advance to the next round | Implemented — host click advances game |

---

## 8. Scoring

| # | Scenario | Notes |
|---|----------|-------|
| 8.1 | Exact colour match scores 100 | `h`, `s`, `l` identical to target — Not implemented (requires exact colour control) |
| 8.2 | Colour within 1σ of all channels scores > 60 | Approximate — Not implemented |
| 8.3 | Colour beyond 3σ on any channel scores 0 | Hard cutoff — Not implemented |
| 8.4 | Describer score equals the average of guesser scores | Not implemented (requires exact colour control) |
| 8.5 | No-clue round: guessers score 100, describer scores 0 | Implemented |
| 8.6 | Skipped guess scores 0 | Not implemented (complex to trigger) |
| 8.7 | Scores accumulate across rounds | Implemented |
| 8.8 | Hue difference is treated as circular (0° ≡ 360°) | Red wrap-around — Not implemented |

---

## 9. Endgame

| # | Scenario | Notes |
|---|----------|-------|
| 9.1 | Full standings shown after final round | All players, all rounds — Implemented |
| 9.2 | Winner(s) displayed with 🏆 | Ties allowed — Implemented |
| 9.3 | Host sees "Replay" and "End Game" buttons | Implemented |
| 9.4 | Non-host sees neither button | Implemented |
| 9.5 | "Replay" resets scores and returns to lobby | Implemented |
| 9.6 | "End Game" closes the room and returns all players to home | Implemented |
| 9.7 | Replay starts a new sequence with the same players | Implemented |

---

## 10. Daily challenge

| # | Scenario | Notes |
|---|----------|-------|
| 10.1 | `/daily` loads and shows today's prompt | Implemented (smoke test only) |
| 10.2 | Colour wheel is interactive before submission | Implemented (smoke test only) |
| 10.3 | A confirmation dialog appears before submitting | Not implemented |
| 10.4 | After submission, the user's colour vs. community average is shown | Not implemented |
| 10.5 | Score and distance from average are displayed | Not implemented |
| 10.6 | Submitting the same challenge a second time is rejected | Not implemented |
| 10.7 | Community stats (H/S/L mean and σ) are shown after submission | Not implemented |
| 10.8 | 30-day history calendar renders | Not implemented |
| 10.9 | Completed days in the calendar show the submitted colour | Not implemented |
| 10.10 | Clicking an unsubmitted past day loads that challenge | Not implemented |
| 10.11 | Streak counter shows 🔥 when today is already submitted | Not implemented |
| 10.12 | Streak counter shows ⏳ when today is not yet submitted | Not implemented |

---

## 11. Session & reconnection

| # | Scenario | Notes |
|---|----------|-------|
| 11.1 | Refreshing the page while in lobby re-joins automatically | Session in `localStorage` — Not implemented (rejoin race conditions) |
| 11.2 | Refreshing during a round reconnects and shows the correct phase | Not implemented (rejoin race conditions) |
| 11.3 | Session expires after 12 hours and redirects to home | Not implemented (impractical to test) |
| 11.4 | Navigating to a room URL with a saved session auto-rejoins | Not implemented (rejoin race conditions) |
| 11.5 | Navigating to a room URL without a saved session shows join form | Implemented |

---

## 12. Multiplayer edge cases

| # | Scenario | Notes |
|---|----------|-------|
| 12.1 | Host disconnect transfers host to next-oldest player | Not implemented (requires network control) |
| 12.2 | Describer disconnect during describing nullifies the round (+100 to others) | Not implemented |
| 12.3 | Describer disconnect during guessing removes them without nullifying | Not implemented |
| 12.4 | Non-describer disconnect during guessing removes them; round completes | Not implemented |
| 12.5 | All players except one disconnect — last player sees a graceful state | Not implemented |
| 12.6 | Player rejoins mid-round and sees the correct phase | Not implemented |
| 12.7 | Simultaneous colour submissions from all guessers trigger reveal once | Not implemented |
| 12.8 | Two players create games at the same time — room codes are unique | Implemented |

---

## 13. Accessibility & responsiveness

| # | Scenario | Notes |
|---|----------|-------|
| 13.1 | All interactive controls are keyboard-navigable | Tab, Enter, Space — Not implemented |
| 13.2 | Colour wheel is operable via keyboard or sliders alone | Motor accessibility — Not implemented |
| 13.3 | Mobile viewport (375 × 812) — game is playable without horizontal scroll | Implemented (all tests run on Pixel 5) |
| 13.4 | Tablet viewport (768 × 1024) — layout adapts correctly | Implemented |
| 13.5 | Font sizes are legible at 100% zoom on desktop | Implemented |

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
