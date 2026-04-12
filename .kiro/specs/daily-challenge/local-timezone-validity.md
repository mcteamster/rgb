# Daily Challenge — Local Timezone Validity

## Overview

Currently the daily challenge rotates at UTC midnight, which means users in non-UTC timezones can be cut off mid-day. This spec covers making each challenge valid for the full local calendar day of every user worldwide — from the first timezone to see a new day (UTC+14, Christmas Island) to the last (UTC-12, Baker Island).

## Problem Statement

- The EventBridge rule fires at `0 0 * * *` (UTC midnight), so a UTC-5 user at 11pm local sees the challenge rotate under them
- `get-current-challenge.ts` computes `challengeId` as today's UTC date server-side, ignoring the client's local date
- Countdowns and "today" checks in the frontend use UTC, not local time
- The 30-day expiry cutoff uses UTC midnight, meaning UTC-12 users can be cut off up to 12 hours before their local day ends

## Design Decisions

### Challenge ID format
Challenge IDs remain `YYYY-MM-DD` strings. When the EventBridge fires at **10:00 UTC**, the UTC+14 date is computed (adding 14 hours) to determine the ID. This means challenges are always created 14 hours before UTC midnight, so every timezone already has the challenge available when their local day begins.

### Client sends `localDate`
Rather than the server guessing the user's timezone, the client computes its local date (`YYYY-MM-DD` in the browser's timezone) and passes it as a query param. The server fetches whichever challenge the client says it's currently playing.

### Baker Island (UTC-12) as the expiry reference
UTC-12 is the last timezone to finish each calendar day. Their midnight = noon UTC the next day. All 30-day expiry checks use UTC-12 time as the reference so no user is cut off before their local day ends.

## Changes Required

### Infrastructure

#### `service/lib/daily-challenge-stack.ts`
- Change EventBridge cron `hour: '0'` → `hour: '10'`
- Fires at 10:00 UTC = midnight UTC+14 (the first new day anywhere on Earth)

### Backend Lambda Functions

#### `service/lambda/rest/create-daily-challenge.ts`
- **`challengeId`**: compute as UTC+14 date instead of UTC date
  ```ts
  const utcPlus14 = new Date(Date.now() + 14 * 60 * 60 * 1000);
  const challengeId = utcPlus14.toISOString().split('T')[0];
  ```
- **`oldChallengeId`** (30-day cleanup): use Baker Island (UTC-12) reference so users there have finished their day before the challenge is marked inactive
  ```ts
  const bakerIslandNow = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(bakerIslandNow);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const oldChallengeId = thirtyDaysAgo.toISOString().split('T')[0];
  ```

#### `service/lambda/rest/get-current-challenge.ts`
- Accept optional `localDate` query param (YYYY-MM-DD in client's local timezone)
- If provided, use it as `challengeId`; otherwise fall back to UTC+14 date (consistent with creation)
  ```ts
  const utcPlus14 = new Date(Date.now() + 14 * 60 * 60 * 1000);
  const challengeId = event.queryStringParameters?.localDate
    || utcPlus14.toISOString().split('T')[0];
  ```

#### `service/lambda/rest/submit-challenge.ts`
- 30-day expiry check: use Baker Island (UTC-12) time instead of UTC
  ```ts
  const bakerIslandNow = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(bakerIslandNow);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (challengeDate < thirtyDaysAgo) { /* 410 */ }
  ```

#### `service/lambda/rest/get-challenge-by-date.ts`
- Same Baker Island fix for the 30-day expiry check (currently uses UTC midnight as the cutoff reference)

### Frontend

#### `client/src/services/dailyChallengeApi.ts`
- `getCurrentChallenge(userId)`: compute and send `localDate`
  ```ts
  const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
  fetch(`${baseUrl}/daily-challenge/current?userId=${userId}&localDate=${localDate}`)
  ```

#### `client/src/components/daily-challenge/DailyChallengeDisplay.tsx`
- `formatTimeRemaining`: replace countdown to `validUntil` (UTC midnight stored in DB) with countdown to end of the user's local day
  ```ts
  const endOfLocalDay = new Date();
  endOfLocalDay.setHours(23, 59, 59, 999);
  const diff = endOfLocalDay.getTime() - now.getTime();
  ```

#### `client/src/components/GameNavbar.tsx`
- `shortDate` (line 33): remove `timeZone: 'UTC'` so it displays the user's local date
- `timeLeft`: count down to end of local day instead of `validUntil` from the API response

#### `client/src/components/daily-challenge/DailyChallengeHistory.tsx`
- `today` (line 72): change `new Date().toISOString().split('T')[0]` to `new Date().toLocaleDateString('en-CA')` so the streak indicator and "played today" check use the user's local date

## Timing Verification

| Timezone | New day starts (UTC) | Challenge available? |
|---|---|---|
| UTC+14 (Christmas Island) | April 11 10:00 UTC | Created exactly then ✓ |
| UTC+10 (Sydney) | April 11 14:00 UTC | Created 4h earlier ✓ |
| UTC | April 12 00:00 UTC | Created 14h earlier ✓ |
| UTC-8 (Los Angeles) | April 12 08:00 UTC | Created 22h earlier ✓ |
| UTC-12 (Baker Island) | April 12 12:00 UTC | Created 26h earlier ✓ |

### 30-day expiry boundary (Baker Island worst case)

Challenge `2026-03-12` (UTC+14 date, created March 11 10:00 UTC):
- Baker Island's March 12 ends at March 13 12:00 UTC
- UTC-based cutoff at April 11 00:00 UTC: March 12 00:00 < March 13 00:00 → would block ✗
- Baker Island-based cutoff at April 11 00:00 UTC: Baker Island is April 10, so cutoff = March 11 → March 12 > March 11 → allowed ✓

## What Does NOT Change

- `create-daily-challenge.ts` `validFrom`/`validUntil` fields — still set to UTC boundaries; they become unused by the client for countdown purposes but kept for reference
- Challenge creation prompt logic and fallback behaviour
- Submission deduplication (one submission per user per challengeId)
- `get-challenge-by-date.ts` endpoint for history browsing (only the 30-day check changes)
- DynamoDB table schema
- All other lambda functions

## Testing Checklist

- [ ] Challenge created at 10:00 UTC has a `challengeId` equal to tomorrow's UTC date
- [ ] UTC+14 user requesting `localDate = tomorrow's UTC date` gets the new challenge
- [ ] UTC-12 user requesting `localDate = today` gets the correct challenge up until their local midnight
- [ ] 30-day expiry: a challenge exactly 30 days old is still accessible for a UTC-12 user at 11:59pm local
- [ ] Countdown in `DailyChallengeDisplay` shows hours until local midnight, not UTC midnight
- [ ] `GameNavbar` shows the user's local date, not UTC date
- [ ] `DailyChallengeHistory` "played today" indicator matches local date
- [ ] Existing unit tests updated for new Baker Island expiry logic
- [ ] E2E tests updated for `localDate` param and local-day countdown
