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
- **API Gateway**: WebSocket API support
- **CloudFront**: Global CDN for static assets

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
### Color Wheel Optimization
- **Saturation curve**: 0.2 exponent emphasizes high-saturation regions (20-100% generation range)
- **Lightness mapping**: 15-85% generation range occupies 98% of wheel area with 3/4 exponent curve
- **Extreme compression**: 0-15% and 85-100% lightness compressed to 1% radius each
- **Playable precision**: 98% of wheel dedicated to colors actually generated in gameplay
- **Full spectrum access**: Players can still select any HSL color (0-100% all components) for accurate guessing
- **Round timing integrity**: Server-enforced round durations, no client-side manipulation

## Development Constraints

### Code Quality
- **TypeScript**: Strict mode enabled
- **Test coverage**: > 80% for critical game logic
- **Bundle analysis**: Automated size monitoring
- **Performance budgets**: CI/CD performance regression detection

### Deployment
- **Zero-downtime**: Blue/green deployment strategy
- **Rollback capability**: < 5 minute rollback time
- **Environment parity**: Dev/staging/prod consistency
