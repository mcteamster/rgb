# Daily Challenge Management Scripts

## Unified CLI Tool

The `manage-challenges` script provides a unified interface for managing daily challenges.

### Commands

#### Create Active Challenge
Create and immediately activate a challenge:
```bash
npm run manage-challenges -- create --date 2026-02-10 --prompt "Sunset colors"
```

#### Queue Future Challenge
Queue a challenge for automatic activation at midnight UTC:
```bash
npm run manage-challenges -- queue --date 2026-02-15 --prompt "Ocean waves"
```

#### Bulk Import
Add multiple queued prompts from a JSON file:
```bash
npm run manage-challenges -- bulk --file scripts/prompts.json
```

### JSON File Format

For bulk imports, use this format:
```json
[
  { "date": "2026-02-09", "prompt": "Ocean waves at midnight" },
  { "date": "2026-02-10", "prompt": "Fresh strawberries" },
  { "date": "2026-02-11", "prompt": "Morning coffee" }
]
```

### Environment Variables

- `AWS_REGION` - AWS region (default: ap-southeast-2)
- `CHALLENGES_TABLE` - DynamoDB table name (default: rgb-daily-challenges)

### Examples

```bash
# Create today's challenge
npm run manage-challenges -- create --date 2026-02-08 --prompt "A color that makes you happy"

# Queue next week's challenges
npm run manage-challenges -- bulk --file scripts/prompts.json

# Queue a single future challenge
npm run manage-challenges -- queue --date 2026-03-01 --prompt "First day of autumn"
```

### Notes

- Challenges with `status: 'queued'` will be automatically activated by the EventBridge scheduled Lambda at midnight UTC
- Active challenges have `validFrom` and `validUntil` timestamps set
- Queued challenges have these fields set to `null` until activation
- The script prevents duplicate challenges (same date)
