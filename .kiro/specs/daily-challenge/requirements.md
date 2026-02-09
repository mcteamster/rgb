# Implementation Plan - Daily Challenge Game Mode

## Problem Statement
Add a single-player daily challenge mode to the RGB color guessing game where all players worldwide receive the same prompt each day and compete to match the collective consensus color. Players are scored based on how close their color choice is to the average of all submissions, creating a "Wordle-style" daily game that rewards intuition about collective color perception.

## Requirements

### Core Functionality
- Daily challenge system with 24-hour submission window (UTC midnight to midnight)
- Single prompt per day (e.g., "Sunset over the ocean") shown to all players
- One submission per user per day
- Dynamic scoring: Players score against the average of all submissions *at the time they submit*
- Live leaderboard showing top 100 players + user's rank
- Personal submission history (last 30 days)
- Anonymous play with localStorage-based user identification

### Technical Requirements
- REST API (separate from existing WebSocket API) for daily challenge operations
- 2 new DynamoDB tables: challenges (with status field for queued/active prompts), submissions
- Dynamic average color calculation in HSL bicone space
- Distance-based scoring algorithm (0-100 points, closer to average = higher score)
- Manual prompt curation system (admin tools to populate queue)
- Responsive UI with mode selector to toggle between Multiplayer and Daily Challenge

### Scoring Algorithm
- Calculate average color from all submissions using bicone Cartesian coordinates
- Score new submission based on Euclidean distance from current average
- Early submitters influence the "consensus" that later submitters are scored against
- Scoring formula: `score = 100 * (1 - distance/maxDistance)`

## Background

### Existing Architecture
- Current multiplayer mode uses WebSocket for real-time communication
- HSL color space with bicone geometry for perceptual distance calculations
- `hslToBiconeCartesian()` function already exists for color space math
- Sophisticated scoring system (`geometricNormalScoring`) for multiplayer mode
- 12-hour game TTL with automatic cleanup
- React frontend with Context-based state management

### Key Design Decisions
1. **Dynamic Scoring**: Calculate average and score immediately on submission (not batch processing)
2. **Anonymous Identity**: localStorage UUID + device fingerprint (no authentication required)
3. **Manual Prompts**: Admin script to pre-populate prompt queue for quality control
4. **Separate Architecture**: REST API instead of WebSocket (simpler for async gameplay)

## Proposed Solution

### Backend
- Add 2 DynamoDB tables for persistent storage (no TTL on challenges, 30-day TTL on submissions)
- Challenges table uses status field ('queued'|'active'|'completed') to manage prompt queue and active challenges
- Create REST API with API Gateway + 5 Lambda functions (GET current challenge, POST submission, GET leaderboard, GET history, scheduled challenge creator)
- Implement average color calculation with new `biconeCartesianToHSL()` inverse transformation
- Add `distanceFromAverageScoring()` algorithm in scoring.ts
- EventBridge scheduled rule to create new challenge daily at UTC midnight

### Frontend
- New `DailyChallengeContext` for state management (parallel to GameContext)
- Mode selector tabs in lobby (Multiplayer vs Daily Challenge)
- 4 new React components: submission flow, results display, leaderboard, history
- Reuse existing ColorWheel and ColorSliders components
- New API client for HTTP requests to REST endpoints

### Admin Tools
- Script to populate prompt queue with future prompts
- Manual challenge creation script for testing/backfill

## Task Breakdown

### Task 1: Backend Infrastructure & Database Schema
**Goal**: Set up DynamoDB tables, REST API, and Lambda functions

**Subtasks**:
- Modify `/service/lib/rgb-stack.ts` to add 2 new DynamoDB tables:
  - `rgb-daily-challenges` (PK: challengeId) - stores daily challenge metadata and queued prompts
    - Attributes: challengeId, prompt, status ('queued'|'active'|'completed'), validFrom (null when queued), validUntil (null when queued), totalSubmissions, createdAt
    - GSI: StatusIndex (PK: status, SK: challengeId) for querying queued prompts
  - `rgb-daily-submissions` (PK: challengeId, SK: userId) - stores all player submissions
    - GSI 1: UserIdIndex (PK: userId, SK: challengeId) for history queries
    - GSI 2: ChallengeLeaderboardIndex (PK: challengeId, SK: score DESC) for leaderboard
- Create REST API Gateway with CORS configuration
- Set up Lambda execution roles with DynamoDB permissions
- Add EventBridge rule for daily challenge creation (cron: `0 0 * * ? *`)

**Demo**: CDK deploys successfully, tables exist in DynamoDB console, API Gateway endpoint responds

### Task 2: Scoring Algorithm Implementation
**Goal**: Implement average color calculation and distance-based scoring

**Subtasks**:
- Add `biconeCartesianToHSL()` function to `/service/lambda/websocket/scoring.ts`:
  - Inverse transformation from 3D Cartesian back to HSL
  - Handle lightness mapping: z ∈ [-1, 1] → l ∈ [0, 100]
  - Handle hue calculation from xy-plane angle: atan2(y, x) → h ∈ [0, 360]
  - Handle saturation from radius and lightness
- Add `calculateAverageColor(colors: HSLColor[])` function:
  - Convert all colors to bicone Cartesian coordinates
  - Calculate centroid (average x, y, z)
  - Convert centroid back to HSL
  - Handle edge cases: 0 colors (gray), 1 color (return as-is)
- Add `distanceFromAverageScoring(submitted, average)` function:
  - Calculate Euclidean distance in bicone space
  - Normalize by max distance (√2)
  - Convert to 0-100 score (invert: closer = higher)

**Demo**: Unit tests pass for various color combinations, edge cases handled correctly

### Task 3: Lambda Functions for Daily Challenge
**Goal**: Implement all backend API operations

**Subtasks**:
- Create `/service/lambda/daily-challenge/get-current-challenge.ts`:
  - Query today's challenge from `rgb-daily-challenges`
  - Query user's submission if userId provided
  - Return challenge metadata + submission status
- Create `/service/lambda/daily-challenge/submit-challenge.ts` (CRITICAL):
  - Validate: challenge is active, user hasn't submitted, color is valid
  - Query all existing submissions for challengeId
  - Calculate current average color using `calculateAverageColor()`
  - Score new submission using `distanceFromAverageScoring()`
  - Store submission with score in DynamoDB (conditional write to prevent duplicates)
  - Update challenge totalSubmissions counter
  - Query GSI to calculate user's rank
  - Return score, rank, average color, distance
- Create `/service/lambda/daily-challenge/get-leaderboard.ts`:
  - Query `ChallengeLeaderboardIndex` GSI (sorted by score desc)
  - Limit to top 100 results
  - Query user's submission and rank if userId provided
  - Return leaderboard + user's position
- Create `/service/lambda/daily-challenge/get-user-history.ts`:
  - Query `UserIdIndex` GSI for user's submissions (sorted by date desc)
  - Limit to last 30 days
  - Calculate aggregate stats (avg score, best score, total played)
  - Return history + stats
- Create `/service/lambda/daily-challenge/create-daily-challenge.ts`:
  - Triggered by EventBridge at midnight UTC
  - Calculate today's challengeId (YYYY-MM-DD)
  - Query `rgb-daily-challenges` for today's queued prompt
  - Update challenge status to 'active' with 24-hour window (or create new if using fallback)
  - Handle missing prompt case (use fallback prompt)

**Demo**: All endpoints respond correctly with Postman/curl, scoring logic verified with test data

### Task 4: Frontend Daily Challenge Context & API Client
**Goal**: Set up state management and HTTP client for daily challenge

**Subtasks**:
- Create `/client/src/utils/userId.ts`:
  - `getUserId()`: Get or create localStorage UUID
  - `getUserName()`: Get saved username
  - `setUserName()`: Save username
  - `generateFingerprint()`: Create browser fingerprint
- Create `/client/src/services/dailyChallengeApi.ts`:
  - HTTP client with methods for all API endpoints
  - `getCurrentChallenge(userId)`: Fetch today's challenge
  - `submitChallenge(submission)`: POST color submission
  - `getLeaderboard(challengeId, userId)`: Fetch leaderboard
  - `getUserHistory(userId)`: Fetch submission history
- Create `/client/src/contexts/DailyChallengeContext.tsx`:
  - State: currentChallenge, userSubmission, leaderboard, isLoading, error
  - Actions: loadCurrentChallenge, submitColor, loadLeaderboard
  - Use useReducer pattern (follow GameContext.tsx structure)
  - Integrate dailyChallengeApi service
- Create `/client/src/types/dailyChallenge.ts`:
  - TypeScript interfaces for API responses
  - DailyChallenge, Submission, LeaderboardEntry types

**Demo**: Context loads challenge data from API, state updates correctly

### Task 5: Daily Challenge UI Components
**Goal**: Build submission flow, results, and leaderboard views

**Subtasks**:
- Create `/client/src/components/DailyChallenge/DailyChallengeContainer.tsx`:
  - Main orchestrator component
  - Conditional rendering based on submission status
  - Show submission form if not submitted, results if submitted
- Create `/client/src/components/DailyChallenge/DailyChallengeSubmission.tsx`:
  - Display prompt and countdown timer
  - Reuse ColorWheel and ColorSliders components
  - Username input (persisted to localStorage)
  - Submit button with confirmation dialog
  - Handle submission API call
  - Show success message after submission
- Create `/client/src/components/DailyChallenge/DailyChallengeResults.tsx`:
  - Display user's submitted color vs average color (side-by-side ColorBox)
  - Show score, rank, distance from average
  - CTA button to view full leaderboard
  - Show challenge prompt and total submissions count
- Create `/client/src/components/DailyChallenge/DailyChallengeLeaderboard.tsx`:
  - Display top 100 players with rank, name, score, color swatch
  - Highlight user's row if they submitted
  - Show challenge prompt at top
  - Handle loading and error states
- Create `/client/src/components/DailyChallenge/DailyChallengeHistory.tsx` (optional for MVP):
  - Display user's past 30 days of submissions
  - Show prompt, submitted color, average color, score, rank for each
  - Display aggregate stats (avg score, best score, total played)

**Demo**: Complete UI flow from submission to results to leaderboard works with mock data

### Task 6: Integrate Daily Challenge with Main App
**Goal**: Add mode selector and routing for daily challenge

**Subtasks**:
- Modify `/client/src/components/PlayerLobby.tsx`:
  - Add mode state: 'multiplayer' | 'daily'
  - Add tab selector UI at top of lobby
  - Conditionally render DailyChallengeContainer when mode = 'daily'
  - Keep existing multiplayer lobby when mode = 'multiplayer'
- Modify `/client/src/App.tsx`:
  - Add routes for daily challenge views
  - Wrap routes with DailyChallengeProvider
  - Add `/daily-challenge` route
  - Add `/daily-challenge/leaderboard` route
  - Keep existing multiplayer routes
- Update environment variables:
  - Add `VITE_DAILY_CHALLENGE_API_URL` to `.env` and build config
  - Point to REST API Gateway endpoint
- Add CSS for daily challenge components:
  - Mode selector tabs styling
  - Daily challenge card layouts
  - Leaderboard table styling
  - Mobile responsive adjustments

**Demo**: User can toggle between modes, full daily challenge flow works end-to-end

### Task 7: Admin Tools & Scheduled Jobs
**Goal**: Create tools to manage prompts and test challenges

**Subtasks**:
- Create `/service/scripts/add-prompts.ts`:
  - CLI script to add prompts to challenges table with 'queued' status
  - Accept CSV or JSON file with dates and prompts
  - Batch insert into `rgb-daily-challenges` table with status='queued', validFrom=null, validUntil=null
  - Usage: `npm run add-prompts -- --file prompts.csv`
- Create `/service/scripts/create-challenge-manual.ts`:
  - CLI script to manually create a challenge
  - Accept date and prompt as arguments
  - Insert into `rgb-daily-challenges` table with status='active'
  - Usage: `npm run create-challenge -- --date 2026-02-07 --prompt "Sunset"`
- Test EventBridge scheduled rule:
  - Verify challenge creation at midnight UTC
  - Monitor CloudWatch logs for errors
  - Test with manual invocation first

**Demo**: Admin can populate 7+ days of prompts, scheduled Lambda creates challenges automatically

### Task 8: Testing & Edge Case Handling
**Goal**: Comprehensive testing of edge cases and error scenarios

**Subtasks**:
- Unit tests for scoring algorithms:
  - Test `calculateAverageColor()` with various combinations
  - Test edge cases: 0 colors, 1 color, opposite hues, grayscale
  - Test `biconeCartesianToHSL()` inverse transformation accuracy
  - Test `distanceFromAverageScoring()` with known distances
- Integration tests for submission flow:
  - Test first submission (average = submitted, score = 100)
  - Test 2nd, 3rd, 10th submission (verify average updates)
  - Test duplicate submission (verify rejection)
  - Test expired challenge submission (verify rejection)
  - Test invalid color values (verify validation)
- End-to-end testing:
  - Create test challenge manually
  - Submit 5 colors from 5 different localStorage UUIDs
  - Verify each score is calculated against average at time of submission
  - Verify leaderboard shows correct rankings
  - Verify history queries work
  - Test on multiple browsers and devices
- Edge case handling:
  - Challenge expires during submission: API returns error, UI shows message
  - No prompt available: Scheduled Lambda alerts admin, doesn't create challenge
  - User clears localStorage: New UUID generated, history lost (acceptable)
  - Leaderboard query timeout: Set 10s timeout, return partial results
  - Average color edge cases: Test colors at hue boundaries (0°/360°)

**Demo**: All tests pass, edge cases handled gracefully, no console errors

## Deployment Checklist

### Pre-Deployment
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] CDK diff shows expected changes
- [ ] Backup existing infrastructure (if needed)
- [ ] Populate prompt queue with 7+ days of prompts

### Deployment Steps
1. Deploy backend infrastructure: `npm run deploy --workspace=service`
2. Verify tables exist in DynamoDB console
3. Test API endpoints with Postman/curl
4. Manually create test challenge for today
5. Build frontend: `npm run build --workspace=client`
6. Deploy frontend to hosting (S3/CloudFront or existing host)
7. Test in production: submit color, verify score calculation
8. Enable EventBridge rule for scheduled challenge creation
9. Monitor CloudWatch logs for first 24 hours

### Post-Deployment
- [ ] Verify first automated challenge creates successfully
- [ ] Monitor API error rates
- [ ] Check DynamoDB read/write capacity metrics
- [ ] Gather user feedback
- [ ] Monitor leaderboard query performance with increasing submissions

## Success Metrics
- Daily active users (DAU) for daily challenge
- Submission rate (% of users who view challenge vs submit)
- Average submissions per day (target: 100+ within first week)
- Average score distribution (should be bell curve around 70-80)
- API error rate (target: <1%)
- Leaderboard load time (target: <2s)
- User retention (% returning next day)

## Future Enhancements (Out of Scope)
- User authentication (OAuth) for cross-device history
- Streak tracking and achievements
- Challenge archives (play past challenges)
- Social features (share results, compare with friends)
- Regional leaderboards
- Community prompt suggestions and voting
- Color clustering visualization
- Push notifications for daily reminders
- Multiple difficulty levels
- Themed challenges (e.g., "Nature week")
