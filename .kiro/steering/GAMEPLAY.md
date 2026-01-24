---
inclusion: always
---

# RGB Gameplay Mechanics

## Game Overview
RGB is a multiplayer color communication game where players must describe and guess colors using only words. The game tests players' ability to communicate visual concepts through language.

## Core Gameplay Loop

### 1. Game Setup
- **Players**: 2-10 players per game
- **Rounds**: Multiple rounds, each with a different describer
- **Objective**: Score points by accurately guessing colors from descriptions

### 2. Round Structure

#### Phase 1: Description (30 seconds)
- **Describer Selection**: One player randomly chosen as describer, all players must take a turn describing before having a second turn describing
- **Target Color**: System generates random HSL color
- **Describer Task**: Write text description of the target color
- **Other Players**: Wait and prepare to guess
- **Constraints**: No color names, hex codes, or RGB values allowed

#### Phase 2: Guessing (15 seconds)
- **Guesser Task**: Select color using HSL color picker based on description
- **Real-time Updates**: Players see others' draft colors as they adjust (if enabled)
- **Submission**: Final color locked in when submitted, or draft color is chosen when time runs out
- **Describer Role**: Cannot guess, watches others attempt

#### Phase 3: Reveal
- **Target Display**: Show the actual target color
- **Submissions Display**: Show all player guesses
- **Scoring**: Calculate and display scores based on color accuracy
- **Next Round**: Automatic progression after brief reveal period or manual override

### 3. Scoring System

#### Distance Calculation
- **Color Space**: HSL (Hue, Saturation, Lightness)
- **Distance Formula**: Euclidean distance in HSL space
- **Normalization**: Hue wraps around (0° = 360°)

#### Point Allocation
- **Perfect Match**: 100 points (distance = 0)
- **Close Match**: 90-99 points (very small distance)
- **Good Match**: 70-89 points (reasonable distance)
- **Poor Match**: 0-69 points (large distance)
- **Describer Bonus**: Receives average of all guesser scores

#### Cumulative Scoring
- **Round Scores**: Added to player totals
- **Leaderboard**: Real-time ranking display
- **Final Winner**: Highest total score after all rounds

## Game Flow States

### Waiting State
- **Condition**: Game created, waiting for players
- **Actions**: Players can join
- **Transition**: Manual start when ready (minimum 2 players)

### Playing State
- **Condition**: Round in progress
- **Phases**: Description → Guessing → Reveal
- **Transition**: Automatic progression through phases

### Round Transitions
- **Next Round**: New describer selected randomly, all players must take a turn describing before having a second turn describing
- **Game End**: After predetermined rounds or manual stop
- **Return to Waiting**: Option to play again with same players

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
- **Reconnection**: Automatic rejoin on page refresh
- **Kick/Remove**: Host can remove disruptive players

## Technical Constraints

### Timing Enforcement
- **Server-side Deadlines**: Automatic phase transitions
- **Grace Period**: Brief buffer for network latency
- **Timeout Handling**: Incomplete guesses use the draft for scoring

### Color Validation
- **HSL Bounds for Generated Colors**: H: 0-360°, S: 20-100%, L: 15-85%
- **Player Selection Range**: Full HSL spectrum (H: 0-360°, S: 0-100%, L: 0-100%)
- **Precision**: 1-degree hue, 1% saturation/lightness
- **Input Validation**: Server-side validation for generated colors only

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
- **Random Describer**: Turn order is fair, all players get to describe the same number of times
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

## Future Enhancements

### Potential Features
- **Custom Color Palettes**: Themed color sets
- **Difficulty Modes**: Easy/medium/hard color ranges
- **Team Play**: Collaborative guessing modes
- **Tournaments**: Multi-game competitions
- **Statistics**: Player performance tracking

### Advanced Mechanics
- **Bonus Rounds**: Special scoring opportunities
- **Power-ups**: Temporary advantages
- **Challenges**: Specific color categories
- **Achievements**: Unlock system for engagement
