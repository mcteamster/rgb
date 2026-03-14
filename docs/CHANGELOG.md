# Changelog

Notable changes to On the Spectrum.

---

## [Unreleased] — Mar 14, 2026

### Added

- **Daily challenge preview in navbar** — when no game is active, the navbar cycles through today's prompt, the date, and a countdown to midnight reset. Tapping navigates directly to `/daily`. Powered by a new `useCyclingText` hook and `CyclingText` component.
- **Discord MinimisedView** — a compact overlay for Discord's small-screen embed preview. Shows the current game phase (✏️ describing / 🎨 guessing / 🎯 reveal / 🏆 endgame), whose turn it is, a live countdown timer, and the player's score — with the background colour tracking the player's live colour selection in real time.
- **Lambda memory increase** — daily-challenge Lambda functions have been allocated additional memory for faster cold starts and execution.

### Changed

- **Consolidated history & calendar** — the separate Daily Challenge calendar panel has been merged into the history view. One tap from the navbar now opens a unified scrollable timeline of past submissions with scores and streaks.

### Fixed

- **Streak validation** — `submittedAt` dates are now validated server-side before contributing to streak calculations, preventing inflated streaks from malformed history entries.
- **Viewport resize** — fixed a race condition where the game container reported zero dimensions on initial render, causing a negative canvas radius crash on Chromium and Brave when joining via a URL path (e.g. QR code link).
- **Font size and date cutoff** — UI polish fixes for text sizing and date display truncation in the daily challenge history view.
