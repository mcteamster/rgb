---
inclusion: always
---

# RGB Gameplay Mechanics

## Game Overview
RGB is a multiplayer color communication game where players must describe and guess colors using only words. The game tests players' ability to communicate visual concepts through language.

## Game Modes

### Multiplayer Mode
- 2-10 players per game
- Real-time WebSocket communication
- Configurable time limits and rounds
- Host-controlled game flow

### Daily Challenge Mode
- Single-player asynchronous mode
- New prompt every day (UTC midnight)
- Score based on distance from community average
- History tracking and statistics
- Calendar view for past challenges

## Core Gameplay Loop (Multiplayer)

### 1. Game Setup
- **Players**: 2-10 players per game
- **Configuration**:
  - `maxPlayers`: 2-10 (default: 10)
  - `descriptionTimeLimit`: 10s-24h or 0 for unlimited (default: 30s)
  - `guessingTimeLimit`: 5s-24h or 0 for unlimited (default: 15s)
  - `turnsPerPlayer`: 1-5 turns each player describes (default: 2)
- **Host**: Earliest-joined player, only host can start game
- **Objective**: Score points by accurately guessing colors from descriptions

### 2. Round Structure

#### Phase 1: Description (configurable time)
- **Describer Selection Algorithm**:
  - Tracks clue count per player
  - Selects from players with minimum clues given
  - Among eligible, chooses who gave clue longest ago
  - Avoids back-to-back selection when possible
  - First round only: random selection among eligible
- **Target Color**: System generates random HSL color (H: 0-360°, S: 20-100%, L: 15-85%)
- **Describer Task**: Write text description (max 100 characters)
- **Draft Updates**: Real-time draft description visible to describer only
- **Other Players**: Wait and prepare to guess
- **Timeout Behavior**: If no description provided, skip to reveal with special scoring

#### Phase 2: Guessing (configurable time)
- **Guesser Task**: Select color using HSL color picker (full range: H: 0-360°, S: 0-100%, L: 0-100%)
- **Real-time Updates**: Players see others' draft colors as they adjust
- **Submission**: Final color locked in when submitted
- **Timeout Behavior**: Draft color automatically submitted when time expires
- **Describer Role**: Cannot guess, watches others attempt

#### Phase 3: Reveal
- **Target Display**: Show the actual target color
- **Submissions Display**: Show all player guesses with scores
- **Scoring**: Calculate and display scores based on color accuracy
- **Next Round**: Manual progression by host or any player

### 3. Scoring System

#### Distance Calculation
- **Algorithm**: Geometric normal distribution with 3-sigma thresholds
- **Color Space**: HSL (Hue, Saturation, Lightness)
- **Component Weights**: Hue: 6.0, Saturation: 1.0, Lightness: 2.0
- **Sigma Values**: 
  - Hue: 25° (adjusted for lightness extremity)
  - Saturation: 25%
  - Lightness: 15% (adjusted proportionally to target lightness)
- **3-Sigma Cutoff**: Guesses beyond 3-sigma from target score 0 points
- **Hue Normalization**: Wraps around (0° = 360°)

#### Point Allocation
- **Perfect Match**: 100 points
- **Normal Distribution**: Score decreases based on weighted geometric mean of component distances
- **Zero Score**: Beyond 3-sigma threshold in any component
- **Describer Bonus**: Receives average of all guesser scores (rounded)

#### Special Scoring Cases
- **No Clue Provided**: All guessers get +100 points, describer gets 0
- **Timeout with No Submission**: Uses draft color for scoring

#### Cumulative Scoring
- **Round Scores**: Added to player totals after each reveal
- **Leaderboard**: Real-time ranking display
- **Final Winner**: Highest total score after all rounds complete

## Game Flow States

### Waiting State
- **Condition**: Game created, waiting for players
- **Actions**: Players can join
- **Transition**: Manual start by host when ready (minimum 2 players)

### Playing State
- **Condition**: Round in progress
- **Phases**: Description → Guessing → Reveal
- **Transition**: Automatic progression through phases

### Endgame State
- **Condition**: All players have completed `turnsPerPlayer` turns as describer
- **Display**: Final leaderboard and winner announcement
- **Actions**: Can reset game or close room

### Round Transitions
- **Next Round**: New describer selected via algorithm
- **Game End**: After all players complete `turnsPerPlayer` turns
- **Return to Waiting**: Host can reset game to play again

## Player Interactions

### Real-time Features
- **Draft Visibility**: See others' color selections as they adjust
- **Live Updates**: Player join/leave notifications
- **Sync Polling**: Automatic state synchronization every 5 seconds

### Communication Rules
- **Description Phase**: Only describer can type
- **Guessing Phase**: No text communication allowed
- **Visual Only**: Communication through color selection only

### Player Management
- **Join/Leave**: Players can join/leave between rounds
- **Reconnection**: Automatic rejoin on page refresh (rejoinGame action)
- **Kick/Remove**: Host can remove disruptive players
- **Host Transfer**: Host is always earliest-joined player

## Daily Challenge Mode

### Overview
- **Single-player**: Asynchronous gameplay, no real-time opponents
- **Daily Rotation**: New challenge at UTC midnight
- **Prompt-based**: Text prompt describes a color concept or feeling
- **Community Scoring**: Score based on distance from average of all submissions

### Challenge Lifecycle
- **Creation**: Automated via EventBridge scheduler
- **Duration**: 24 hours (UTC midnight to midnight)
- **Prompts**: Pre-queued or fallback prompts
- **Archival**: Challenges older than 30 days marked inactive

### Gameplay Flow
1. **View Prompt**: Read daily text prompt
2. **Select Color**: Choose HSL color that matches prompt
3. **Submit**: Lock in color choice (one submission per user per day)
4. **Reveal**: See your color vs community average
5. **Score**: Distance from average determines score (closer = better)

### Scoring
- **Algorithm**: Same geometric normal distribution as multiplayer
- **Target**: Community average color (calculated from all submissions)
- **Updates**: Average recalculates with each new submission
- **History**: Track all past submissions and scores

### Features
- **User History**: View all past challenge submissions
- **Statistics**: Total played, average score, best score, current streak
- **Calendar View**: Browse past challenges by date
- **Anonymous ID**: Local storage-based user identification

## Technical Constraints

### Timing Enforcement
- **Server-side Deadlines**: Automatic phase transitions
- **Grace Period**: Brief buffer for network latency
- **Timeout Handling**: Incomplete guesses use the draft for scoring

### Color Wheel Implementation

#### HSL Color Space Mapping

##### Saturation Curve
- **Formula**: `Math.pow((-sin(angle) + 1) / 2, 0.2) × 100`
- **Exponent**: 0.2 (emphasizes high-saturation regions for 20-100% generation range)
- **Effect**: More angular space allocated to vibrant colors (80-100% saturation)

##### Lightness Distribution
- **Compression**: Top and bottom 15% compressed into 1% of radius each
- **85-100% lightness**: First 1% of radius (center to 1%)
- **15-85% lightness**: Middle 98% of radius (1% to 99%) with 3/4 exponent curve
- **0-15% lightness**: Last 1% of radius (99% to 100% - edge)
- **Playable area**: 98% of circle dedicated to 15-85% generation range
- **Curve formula**: `Math.pow(1 - normalizedDistance, 3/4)` emphasizes higher lightness values

##### Optimization Results
- **Generation range coverage**: 98% of wheel area for 15-85% lightness, full angular space for 20-100% saturation
- **Out-of-bounds compression**: Extreme values (0-15% and 85-100% lightness) compressed to 1% radius each
- **Precision**: Maximum control over colors that will actually be generated in gameplay

### Regional Game Codes
- **Format**: 4-character codes (3 random + 1 region indicator)
- **Encoding**: Last character indicates AWS region
  - BC: Australia (ap-southeast-2)
  - DF: Japan (ap-northeast-1)
  - GH: Singapore (ap-southeast-1)
  - JK: India (ap-south-1)
  - LM: Europe (eu-central-1)
  - NP: UK (eu-west-2)
  - QR: Brazil (sa-east-1)
  - ST: US East (us-east-1)
  - VW: US West (us-west-2)
  - XZ: Local/Fallback
- **Purpose**: Players can identify server location for latency awareness

### Concurrency Handling
- **Atomic Operations**: DynamoDB conditional updates
- **Race Conditions**: Proper handling of simultaneous submissions
- **State Consistency**: Server authoritative game state

## Game Balance

### Difficulty Factors
- **Color Complexity**: Some colors harder to describe than others
- **Time Pressure**: Limited time creates urgency
- **Vocabulary Challenge**: Requires creative description skills

### Fairness Measures
- **Fair Describer Rotation**: Algorithm ensures all players describe equal times, selecting from those with fewest turns
- **Longest-ago Selection**: Among eligible players, chooses who hasn't described most recently
- **Avoid Back-to-back**: Prevents same player describing consecutive rounds when possible
- **Consistent Timing**: Same time limits for all players
- **Objective Scoring**: Mathematical distance calculation

### Accessibility
- **Color Picker**: Full HSL spectrum access required
- **Clear UI**: Intuitive color selection interface
- **Responsive Design**: Works on various screen sizes

## Victory Conditions

### Round Winner
- **Closest Guess**: Player with smallest color distance
- **Tie Breaking**: Multiple players can tie for closest

### Game Winner
- **Highest Total**: Sum of all round scores
- **Final Ranking**: Leaderboard with all player scores
- **Celebration**: Winner announcement and score display

## API Architecture

### WebSocket API (Multiplayer)
- **Connection**: Persistent WebSocket for real-time gameplay
- **Actions**: createGame, joinGame, rejoinGame, startRound, submitDescription, submitColor, kickPlayer, resetGame, closeRoom
- **Events**: gameStateUpdated, metaUpdated, playersUpdated, gameplayUpdated, configUpdated, kicked, error
- **Validation**: Server-side player authorization for all actions

### REST API (Daily Challenge)
- **GET /current**: Fetch current daily challenge
- **POST /submit**: Submit color for challenge
- **GET /history**: Get user's submission history
- **GET /stats**: Get challenge statistics
- **GET /challenge/{date}**: Get specific challenge by date
- **POST /create**: Create new daily challenge (EventBridge only)
