# Daily Challenge Mode - Implementation Summary

This document summarizes the Daily Challenge game mode implementation for the RGB color guessing game.

## Overview

The Daily Challenge mode is a single-player game mode where all players worldwide receive the same text prompt each day at UTC midnight. Players submit one color guess per day, and their score is based on how close their color is to the **average of all submissions so far**.

## Key Features

- **Daily Prompt**: New challenge every 24 hours (UTC midnight)
- **Dynamic Scoring**: Score calculated against the running average of all previous submissions
- **Anonymous Play**: Users identified by localStorage UUID + browser fingerprint
- **Live Leaderboard**: Updates throughout the 24-hour window
- **One Submission Per Day**: Users can only submit once per challenge

## Architecture

### Backend Components

#### DynamoDB Tables
1. **rgb-daily-challenges**: Stores daily challenge metadata
   - Partition Key: `challengeId` (YYYY-MM-DD)
   - Retention: Permanent

2. **rgb-daily-submissions**: Stores all player submissions
   - Partition Key: `challengeId`, Sort Key: `userId`
   - GSI 1: `UserIdIndex` (for user history)
   - GSI 2: `ChallengeLeaderboardIndex` (for leaderboards, sorted by score)
   - TTL: 30 days

3. **rgb-daily-prompts-queue**: Pre-populated future prompts
   - Partition Key: `promptId` (YYYY-MM-DD)
   - Retention: Permanent

#### Lambda Functions
1. **get-current-challenge**: GET current challenge and user submission status
2. **submit-challenge**: POST color submission with dynamic scoring
3. **get-leaderboard**: GET top 100 submissions + user's rank
4. **get-user-history**: GET user's past submissions and stats
5. **create-daily-challenge**: Scheduled function to create daily challenges

#### API Gateway
- REST API with CORS enabled
- Endpoints:
  - `GET /daily-challenge/current?userId={uuid}`
  - `POST /daily-challenge/submit`
  - `GET /daily-challenge/leaderboard/{challengeId}?userId={uuid}`
  - `GET /daily-challenge/history/{userId}`

#### EventBridge
- Scheduled rule: Runs daily at 00:00 UTC
- Triggers `create-daily-challenge` Lambda

### Frontend Components

#### New Files Created
- **contexts/DailyChallengeContext.tsx**: State management
- **services/dailyChallengeApi.ts**: HTTP client for REST API
- **utils/userId.ts**: Anonymous user identity management
- **types/dailyChallenge.ts**: TypeScript interfaces
- **components/DailyChallenge/**:
  - `DailyChallengeContainer.tsx`: Main orchestrator
  - `DailyChallengeSubmission.tsx`: Color picker + submit flow
  - `DailyChallengeResults.tsx`: Score display
  - `DailyChallengeLeaderboard.tsx`: Top 100 leaderboard

#### Modified Files
- **App.tsx**: Added route for `/daily-challenge`
- **PlayerLobby.tsx**: Added mode selector tabs (Multiplayer vs Daily Challenge)

### Algorithms

#### Color Averaging (Bicone Space)
- Converts all HSL colors to 3D Cartesian coordinates in bicone space
- Calculates centroid (average) in 3D space
- Converts back to HSL
- Functions: `calculateAverageColor()`, `biconeCartesianToHSL()`

#### Distance-Based Scoring
- Calculates Euclidean distance in bicone space
- Closer to average = higher score (0-100 points)
- Function: `distanceFromAverageScoring()`

## Deployment Instructions

### 1. Backend Deployment

```bash
cd service
npm install
npm run build
npm run deploy
```

This will:
- Create 3 new DynamoDB tables
- Deploy 5 Lambda functions
- Create REST API Gateway
- Set up EventBridge rule for daily challenge creation

After deployment, note the **DailyChallengeApiUrl** from the CDK output.

### 2. Configure Frontend

Update `client/.env` with the API URL from CDK output:

```bash
VITE_DAILY_CHALLENGE_API_URL='https://your-api-id.execute-api.us-east-1.amazonaws.com/prod'
```

### 3. Populate Initial Prompts

Run the admin script to add 7+ days of prompts:

```bash
cd service

# Option 1: Use the provided script with sample prompts
npm run add-prompts

# Option 2: Manually create a challenge for testing
npm run create-challenge -- --date 2026-02-07 --prompt "Sunset over the ocean"
```

### 4. Deploy Frontend

```bash
cd client
npm install
npm run build
# Deploy to your hosting provider (e.g., Vercel, Netlify, S3+CloudFront)
```

### 5. Enable EventBridge Rule (Production Only)

By default, the EventBridge rule is created but enabled. If you want to disable it for testing:

1. Go to AWS Console → EventBridge → Rules
2. Find `CreateDailyChallengeRule`
3. Disable/Enable as needed

## Testing

### Manual Testing Checklist

1. **First Submission**
   - Submit a color
   - Verify score = 100 (no average yet)
   - Check results screen shows your color and rank #1

2. **Second Submission**
   - Use a different browser/incognito window
   - Submit a different color
   - Verify score is based on average of first submission
   - Check leaderboard shows both submissions

3. **Edge Cases**
   - Try submitting twice with same userId → Should reject
   - Wait for challenge to expire → Should reject new submissions
   - Clear localStorage → Should generate new userId

4. **Leaderboard**
   - View leaderboard with 10+ submissions
   - Verify rankings are correct (highest score first)
   - Check your submission is highlighted

### Lambda Testing

Test individual Lambda functions using AWS Console or SAM:

```bash
# Example: Test get-current-challenge
aws lambda invoke \
  --function-name GetCurrentChallengeFunction \
  --payload '{"queryStringParameters":{"userId":"test-user-123"}}' \
  response.json
```

## Admin Operations

### Add Future Prompts

Edit `service/scripts/add-prompts.ts` to add more prompts, then run:

```bash
npm run add-prompts
```

### Manually Create a Challenge

Useful for backfilling or testing:

```bash
npm run create-challenge -- --date 2026-02-15 --prompt "Your prompt here"
```

### Query Database

Use AWS DynamoDB Console or CLI:

```bash
# Get today's challenge
aws dynamodb get-item \
  --table-name rgb-daily-challenges \
  --key '{"challengeId":{"S":"2026-02-07"}}'

# Query submissions for a challenge
aws dynamodb query \
  --table-name rgb-daily-submissions \
  --key-condition-expression "challengeId = :id" \
  --expression-attribute-values '{":id":{"S":"2026-02-07"}}'
```

## Monitoring

### Key Metrics to Track

1. **Daily Active Users (DAU)**: Count unique userIds per day
2. **Submission Rate**: % of users who view vs submit
3. **Average Score Distribution**: Histogram of scores
4. **Leaderboard Engagement**: Views per challenge
5. **API Errors**: 4xx/5xx response rates
6. **Lambda Performance**: Execution time, cold starts

### CloudWatch Logs

Lambda functions log to CloudWatch:
- `/aws/lambda/GetCurrentChallengeFunction`
- `/aws/lambda/SubmitChallengeFunction`
- `/aws/lambda/GetLeaderboardFunction`
- `/aws/lambda/GetUserHistoryFunction`
- `/aws/lambda/CreateDailyChallengeFunction`

## Known Limitations (MVP)

1. **No Authentication**: Users are anonymous (localStorage UUID)
2. **No Cross-Device Sync**: History tied to device
3. **Manual Prompts**: Admin must pre-populate prompts
4. **Basic Anti-Cheat**: Only fingerprint + localStorage check
5. **No Push Notifications**: Users must visit site to play

## Future Enhancements

See the plan document for a full list of potential enhancements:
- OAuth authentication (Discord, Google)
- Streak tracking and achievements
- Challenge archives (play past challenges)
- Social features (share results, compare with friends)
- Regional leaderboards
- Prompt voting system
- Color clustering visualization
- Push notifications

## File Structure

```
service/
├── lambda/
│   ├── websocket/
│   │   └── scoring.ts (updated with new functions)
│   └── daily-challenge/
│       ├── get-current-challenge.ts
│       ├── submit-challenge.ts
│       ├── get-leaderboard.ts
│       ├── get-user-history.ts
│       └── create-daily-challenge.ts
├── lib/
│   └── rgb-stack.ts (updated with new resources)
└── scripts/
    ├── add-prompts.ts
    └── create-challenge-manual.ts

client/src/
├── components/
│   └── DailyChallenge/
│       ├── DailyChallengeContainer.tsx
│       ├── DailyChallengeSubmission.tsx
│       ├── DailyChallengeResults.tsx
│       └── DailyChallengeLeaderboard.tsx
├── contexts/
│   └── DailyChallengeContext.tsx
├── services/
│   └── dailyChallengeApi.ts
├── types/
│   └── dailyChallenge.ts
└── utils/
    └── userId.ts
```

## Support

For issues or questions:
- Check CloudWatch Logs for Lambda errors
- Verify DynamoDB tables exist and have data
- Ensure API Gateway CORS is configured correctly
- Test API endpoints directly with Postman/curl

## License

Same license as the main RGB game project.
