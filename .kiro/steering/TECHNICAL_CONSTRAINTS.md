---
inclusion: always
---

# RGB Technical Constraints

## Color Space Requirements

### HSL Color Space
- **Full spectrum access**: Must support complete HSL range (H: 0-360°, S: 0-100%, L: 0-100%)
- **Precision**: Minimum 1-degree hue precision, 1% saturation/lightness precision
- **Color picker**: Native HTML5 color input insufficient - requires custom HSL picker
- **Color accuracy**: Consistent color representation across devices and browsers

### Color Communication
- **Color codes**: Support HSL only
- **Validation**: Real-time color value validation and normalization
- **Generation constraints**: Target colors generated with H: 0-360°, S: 20-100%, L: 15-85%
- **Guessing range**: Players can select full HSL range (S/L: 0-100%) for accurate guessing

## Scoring Algorithm

### Geometric Normal Distribution
- **Algorithm**: Weighted geometric mean of normal distribution components
- **3-Sigma Cutoff**: Guesses beyond 3-sigma from target score 0 points
- **Component Weights**: 
  - Hue: 6.0
  - Saturation: 1.0
  - Lightness: 2.0
- **Sigma Values**:
  - Hue: 25° (dynamically adjusted for lightness extremity)
  - Saturation: 25%
  - Lightness: 15% (adjusted proportionally to target lightness)
- **Hue Adjustment**: Sigma multiplier increases for extreme lightness (L < 20 or L > 80)
- **Lightness Adjustment**: Sigma scales proportionally to target lightness (targetL / 50)
- **Score Range**: 0-100 points per guess
- **Describer Score**: Average of all guesser scores (rounded)

## Performance Constraints

### Frontend
- **Bundle size**: < 500KB initial load
- **Memory usage**: < 50MB heap for game session

### Backend
- **WebSocket latency**: < 100ms for real-time updates
- **Concurrent players**: Support 1000+ simultaneous connections
- **Cold start**: Lambda < 1 second initialization

## Browser Compatibility

### Minimum Support
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Required Features
- **WebSocket**: Native support required
- **Canvas API**: For color rendering and manipulation
- **CSS Custom Properties**: For dynamic theming
- **ES2020**: Modern JavaScript features

## Infrastructure Constraints

### AWS Services
- **Regions**: Multi region support
- **Lambda**: Node.js 24 runtime
- **DynamoDB**: On-demand billing, single-table design
- **API Gateway**: WebSocket API for multiplayer, REST API for daily challenges
- **CloudFront**: Global CDN for static assets
- **EventBridge**: Scheduled daily challenge creation (UTC midnight)

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

### Scalability
- **Auto-scaling**: Handle 10x traffic spikes
- **Database**: Single-digit millisecond read/write latency
- **CDN**: 99.9% cache hit ratio for static content

## Security Requirements

### Data Protection
- **No PII storage**: Game data only, no personal information
- **HTTPS only**: All communication encrypted
- **CORS**: Strict origin validation
- **Rate limiting**: API endpoint protection

### Game Integrity
- **Input validation**: Server-side color value validation (HSL ranges, format compliance)
- **Color submission timing**: Enforce minimum think time (2-3 seconds) to prevent automation
- **Rate limiting**: Max 1 color submission per 500ms per player
- **Session validation**: Verify player belongs to game room before accepting actions
- **Client-server sync**: Validate game state consistency on each action
- **Timeout enforcement**: Auto-kick inactive players after 60 seconds
- **Room capacity**: Hard limit of 10 players per game room
- **Reconnection handling**: Allow reconnect within 30 seconds of disconnect
- **Score tampering**: Server-only score calculation and persistence
- **Round timing integrity**: Server-enforced round durations, no client-side manipulation
- **Host authorization**: Only earliest-joined player can start game and kick players
- **Atomic state updates**: DynamoDB conditional expressions prevent race conditions

## Development Constraints

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

### Code Quality
- **TypeScript**: Strict mode enabled
- **Test coverage**: > 80% for critical game logic
- **Bundle analysis**: Automated size monitoring
- **Performance budgets**: CI/CD performance regression detection

### Deployment
- **Zero-downtime**: Blue/green deployment strategy
- **Rollback capability**: < 5 minute rollback time
- **Environment parity**: Dev/staging/prod consistency
