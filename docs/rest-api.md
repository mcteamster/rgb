# REST API Documentation - Daily Challenge

## Overview

The Daily Challenge feature uses a REST API (not WebSocket) for asynchronous, single-player gameplay. Players submit colors based on daily prompts and are scored against the community average.

**Base URL**: `https://api.rgb.mcteamster.com/daily` (production)

**Authentication**: None required (uses anonymous user IDs stored in browser localStorage)

## Endpoints

### GET /current

Fetch the current active daily challenge and user's submission if it exists.

**Request**:
```http
GET /current?userId={userId}
```

**Query Parameters**:
- `userId` (required): Anonymous user identifier from localStorage

**Response** (200 OK):
```json
{
  "challengeId": "2026-02-22",
  "prompt": "A color that makes you happy",
  "validFrom": "2026-02-22T00:00:00.000Z",
  "validUntil": "2026-02-23T00:00:00.000Z",
  "totalSubmissions": 142,
  "userSubmission": {
    "color": { "h": 180, "s": 75, "l": 60 },
    "score": 87,
    "submittedAt": "2026-02-22T03:45:12.000Z",
    "distanceFromAverage": 12.5,
    "averageColor": { "h": 175, "s": 70, "l": 58 }
  }
}
```

**Response** (no submission):
```json
{
  "challengeId": "2026-02-22",
  "prompt": "A color that makes you happy",
  "validFrom": "2026-02-22T00:00:00.000Z",
  "validUntil": "2026-02-23T00:00:00.000Z",
  "totalSubmissions": 142,
  "userSubmission": null
}
```

**Error Responses**:
- `404 Not Found`: No active challenge for today
- `400 Bad Request`: Missing or invalid userId

---

### POST /submit

Submit a color for the current daily challenge.

**Request**:
```http
POST /submit
Content-Type: application/json

{
  "challengeId": "2026-02-22",
  "userId": "abc123def456",
  "userName": "Player123",
  "color": {
    "h": 180,
    "s": 75,
    "l": 60
  },
  "fingerprint": "browser-fingerprint-hash"
}
```

**Request Body**:
- `challengeId` (required): Challenge ID (YYYY-MM-DD format)
- `userId` (required): Anonymous user identifier
- `userName` (optional): Display name for leaderboards
- `color` (required): HSL color object
  - `h`: 0-360 (hue in degrees)
  - `s`: 0-100 (saturation percentage)
  - `l`: 0-100 (lightness percentage)
- `fingerprint` (required): Browser fingerprint for duplicate detection

**Response** (200 OK):
```json
{
  "success": true,
  "submission": {
    "challengeId": "2026-02-22",
    "score": 87,
    "distanceFromAverage": 12.5,
    "averageColor": { "h": 175, "s": 70, "l": 58 },
    "submittedAt": "2026-02-22T03:45:12.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid color values or missing required fields
- `404 Not Found`: Challenge not found or expired
- `409 Conflict`: User already submitted for this challenge

---

### GET /history

Get user's submission history across all daily challenges.

**Request**:
```http
GET /history?userId={userId}&limit={limit}
```

**Query Parameters**:
- `userId` (required): Anonymous user identifier
- `limit` (optional): Maximum number of submissions to return (default: 30)

**Response** (200 OK):
```json
{
  "userId": "abc123def456",
  "submissions": [
    {
      "challengeId": "2026-02-22",
      "prompt": "A color that makes you happy",
      "submittedColor": { "h": 180, "s": 75, "l": 60 },
      "averageAtSubmission": { "h": 175, "s": 70, "l": 58 },
      "score": 87,
      "totalSubmissions": 142
    },
    {
      "challengeId": "2026-02-21",
      "prompt": "The color of a rainy day",
      "submittedColor": { "h": 210, "s": 30, "l": 45 },
      "averageAtSubmission": { "h": 215, "s": 35, "l": 42 },
      "score": 92,
      "totalSubmissions": 156
    }
  ],
  "stats": {
    "totalPlayed": 15,
    "averageScore": 84.3,
    "bestScore": 98,
    "currentStreak": 7
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid userId
- `404 Not Found`: No history found for user

---

### GET /stats

Get statistics for a specific daily challenge.

**Request**:
```http
GET /stats?challengeId={challengeId}
```

**Query Parameters**:
- `challengeId` (required): Challenge ID (YYYY-MM-DD format)

**Response** (200 OK):
```json
{
  "totalSubmissions": 142,
  "averageColor": { "h": 175, "s": 70, "l": 58 },
  "hue": {
    "avg": 175.3,
    "stdDev": 45.2
  },
  "saturation": {
    "avg": 70.1,
    "stdDev": 18.7
  },
  "lightness": {
    "avg": 58.4,
    "stdDev": 12.3
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid challengeId
- `404 Not Found`: Challenge not found

---

### GET /challenge/{date}

Get a specific challenge by date (for calendar view).

**Request**:
```http
GET /challenge/2026-02-15?userId={userId}
```

**Path Parameters**:
- `date` (required): Date in YYYY-MM-DD format

**Query Parameters**:
- `userId` (optional): Include user's submission if provided

**Response** (200 OK):
```json
{
  "challengeId": "2026-02-15",
  "prompt": "The color of nostalgia",
  "validFrom": "2026-02-15T00:00:00.000Z",
  "validUntil": "2026-02-16T00:00:00.000Z",
  "totalSubmissions": 178,
  "averageColor": { "h": 45, "s": 60, "l": 55 },
  "userSubmission": {
    "color": { "h": 50, "s": 65, "l": 52 },
    "score": 94,
    "submittedAt": "2026-02-15T08:23:45.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid date format
- `404 Not Found`: Challenge not found for that date

---

### POST /create (Internal Only)

Create a new daily challenge. This endpoint is only accessible by EventBridge scheduler.

**Request**:
```http
POST /create
Content-Type: application/json

{
  "prompt": "A color that makes you happy"
}
```

**Authorization**: EventBridge service role only

**Response** (200 OK):
```json
{
  "success": true,
  "challengeId": "2026-02-22",
  "prompt": "A color that makes you happy"
}
```

**Error Responses**:
- `403 Forbidden`: Not authorized (not from EventBridge)
- `409 Conflict`: Challenge already exists for today

---

## Data Models

### HSLColor
```typescript
interface HSLColor {
  h: number; // 0-360 degrees
  s: number; // 0-100 percent
  l: number; // 0-100 percent
}
```

### DailyChallenge
```typescript
interface DailyChallenge {
  challengeId: string;        // YYYY-MM-DD format
  prompt: string;             // Text prompt describing color concept
  validFrom: string;          // ISO timestamp (UTC midnight)
  validUntil: string;         // ISO timestamp (next UTC midnight)
  totalSubmissions: number;   // Count of all submissions
  averageColor?: HSLColor;    // Community average (null if <2 submissions)
}
```

### Submission
```typescript
interface Submission {
  color: HSLColor;
  score: number;              // 0-100 based on distance from average
  submittedAt: string;        // ISO timestamp
  distanceFromAverage?: number;
  averageColor?: HSLColor;    // Average at time of submission
}
```

### UserStats
```typescript
interface UserStats {
  totalPlayed: number;        // Total challenges completed
  averageScore: number;       // Mean score across all submissions
  bestScore: number;          // Highest score achieved
  currentStreak: number;      // Consecutive days played
}
```

---

## Scoring Algorithm

Daily challenges use **bicone distance scoring** to measure how close your color is to the community average.

### Bicone Cartesian Space

HSL colors are converted to 3D Cartesian coordinates in bicone geometry:

```typescript
function hslToBiconeCartesian(color: HSLColor) {
    const { h, s, l } = color;
    
    // Bicone radius varies with lightness
    const radius = (s / 100) * Math.min(l, 100 - l) / 50;
    
    // Convert hue to radians
    const hueRad = (h * Math.PI) / 180;
    
    // Cartesian coordinates
    const x = radius * Math.cos(hueRad);
    const y = radius * Math.sin(hueRad);
    const z = (l - 50) / 50; // Normalize lightness to [-1, 1]
    
    return { x, y, z };
}
```

### Why Bicone Space?

The bicone (double cone) geometry accurately represents HSL color space:
- **Radius varies with lightness**: Maximum saturation only possible at L=50%
- **Converges at extremes**: All colors become black (L=0%) or white (L=100%)
- **Euclidean distance**: Meaningful in 3D Cartesian space

### Distance Calculation

```typescript
// Convert both colors to bicone Cartesian
const submittedCart = hslToBiconeCartesian(submittedColor);
const averageCart = hslToBiconeCartesian(averageColor);

// Euclidean distance in 3D space
const distance = Math.sqrt(
    (submittedCart.x - averageCart.x) ** 2 +
    (submittedCart.y - averageCart.y) ** 2 +
    (submittedCart.z - averageCart.z) ** 2
);

// Normalize and invert (closer = higher score)
const maxDistance = Math.sqrt(2); // Corner to corner
const normalizedDistance = Math.min(distance / maxDistance, 1.0);
const score = Math.round(100 * (1 - normalizedDistance));
```

### Average Calculation

Uses **Welford's algorithm** for efficient incremental updates:

1. Convert previous average and new color to bicone Cartesian
2. Calculate new average: `(old_avg × n + new_value) / (n + 1)`
3. Update variance statistics using Welford's algorithm
4. Convert result back to HSL

This allows O(1) average updates without storing all submissions.

### Scoring Examples

**Perfect Match** (same as average):
- Average: H=180°, S=80%, L=50%
- Submission: H=180°, S=80%, L=50%
- Distance: 0.0
- Score: **100 points**

**Close to Average**:
- Average: H=180°, S=80%, L=50%
- Submission: H=185°, S=75%, L=52%
- Distance: ~0.05
- Score: **~96 points**

**Far from Average**:
- Average: H=180°, S=80%, L=50%
- Submission: H=0°, S=20%, L=80%
- Distance: ~1.2
- Score: **~15 points**

### Comparison with Multiplayer

Daily challenge scoring differs from multiplayer:

| Aspect | Multiplayer | Daily Challenge |
|--------|-------------|-----------------|
| **Algorithm** | Geometric normal distribution | Bicone Euclidean distance |
| **Target** | Fixed generated color | Community average |
| **Space** | HSL components | Bicone Cartesian (3D) |
| **Weights** | Component-weighted (H:6, S:1, L:2) | Equal 3D distance |
| **Cutoff** | 3-sigma threshold (0 points) | Linear scaling (0-100) |
| **Purpose** | Accuracy vs fixed target | Consensus finding |

See [hsl-color-scoring.md](./hsl-color-scoring.md) for detailed multiplayer scoring documentation.

---

## Challenge Lifecycle

### Creation
- **Trigger**: EventBridge scheduler at UTC midnight
- **Prompt Source**: Pre-queued prompts or fallback prompt
- **Duration**: 24 hours (UTC midnight to midnight)

### Archival
- **Trigger**: EventBridge scheduler (30 days after creation)
- **Action**: Mark challenge as `inactive`
- **Effect**: No longer returned by `/current` endpoint

### Submission Flow
1. User fetches current challenge via `/current`
2. User selects color based on prompt
3. User submits via `/submit`
4. Server calculates score against current average
5. Server updates average with new submission
6. Server returns score and updated average

---

## Rate Limiting

- **Per User**: 1 submission per challenge (enforced by userId)
- **Per IP**: 100 requests per minute
- **Per Endpoint**: Varies by endpoint complexity

---

## CORS Configuration

**Allowed Origins**:
- `https://rgb.mcteamster.com`
- `http://localhost:5173` (development)

**Allowed Methods**: GET, POST, OPTIONS

**Allowed Headers**: Content-Type, Authorization

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context if applicable"
  }
}
```

**Common Error Codes**:
- `INVALID_COLOR`: Color values out of valid HSL range
- `CHALLENGE_NOT_FOUND`: Challenge doesn't exist or expired
- `ALREADY_SUBMITTED`: User already submitted for this challenge
- `INVALID_USER_ID`: Missing or malformed userId
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## Example Usage

### Fetch Current Challenge
```javascript
const userId = localStorage.getItem('rgb-user-id');
const response = await fetch(`https://api.rgb.mcteamster.com/daily/current?userId=${userId}`);
const challenge = await response.json();
console.log(challenge.prompt); // "A color that makes you happy"
```

### Submit Color
```javascript
const submission = {
  challengeId: challenge.challengeId,
  userId: localStorage.getItem('rgb-user-id'),
  userName: 'Player123',
  color: { h: 180, s: 75, l: 60 },
  fingerprint: await generateFingerprint()
};

const response = await fetch('https://api.rgb.mcteamster.com/daily/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(submission)
});

const result = await response.json();
console.log(`Score: ${result.submission.score}`);
```

### View History
```javascript
const userId = localStorage.getItem('rgb-user-id');
const response = await fetch(`https://api.rgb.mcteamster.com/daily/history?userId=${userId}&limit=10`);
const history = await response.json();
console.log(`Played ${history.stats.totalPlayed} challenges`);
console.log(`Average score: ${history.stats.averageScore}`);
```
