# Daily Challenge Table Consolidation

## Overview
Consolidated the daily challenge feature from 3 tables to 2 tables by merging the prompts queue into the challenges table using a status field. This simplifies the architecture and prepares for future SQL migration.

## Changes Made

### Database Schema

**Before**: 3 separate tables
- `rgb-daily-challenges` - Active challenges
- `rgb-daily-submissions` - User submissions  
- `rgb-daily-prompts-queue` - Queued prompts

**After**: 2 consolidated tables
- `rgb-daily-challenges` - Challenges AND queued prompts (status-based)
- `rgb-daily-submissions` - User submissions (unchanged)

### Challenges Table Schema

**New Structure**:
```typescript
{
  challengeId: string;        // PK: date string (YYYY-MM-DD)
  prompt: string;             // The prompt text
  status: 'queued' | 'active' | 'completed';
  validFrom: string | null;   // ISO timestamp (null when queued)
  validUntil: string | null;  // ISO timestamp (null when queued)
  totalSubmissions: number;   // Default 0
  createdAt: string;          // ISO timestamp
  updatedAt?: string;         // ISO timestamp (when activated)
}
```

**New GSI**: StatusIndex
- Partition Key: `status`
- Sort Key: `challengeId`
- Purpose: Query queued prompts efficiently

### Code Changes

#### 1. CDK Stack (`service/lib/rgb-stack.ts`)
- ✅ Removed `promptsQueueTable` definition
- ✅ Added `StatusIndex` GSI to `dailyChallengesTable`
- ✅ Removed `PROMPTS_QUEUE_TABLE` environment variable
- ✅ Removed prompts queue table permissions

#### 2. Add Prompts Script (`service/scripts/add-prompts.ts`)
- ✅ Changed table name from `rgb-daily-prompts-queue` to `rgb-daily-challenges`
- ✅ Updated item structure:
  - Changed `promptId` to `challengeId`
  - Added `validFrom: null`, `validUntil: null`, `totalSubmissions: 0`
  - Kept `status: 'queued'`

#### 3. Create Daily Challenge Lambda (`service/lambda/daily-challenge/create-daily-challenge.ts`)
- ✅ Removed `PROMPTS_QUEUE_TABLE` constant
- ✅ Removed `PutCommand` import (no longer needed)
- ✅ Changed logic:
  - Single `GetCommand` to check for queued prompt
  - Uses `UpdateCommand` to activate challenge (instead of separate Put + Update)
  - Adds `ConditionExpression` to prevent race conditions
  - Sets `updatedAt` timestamp when activating

#### 4. Requirements Document (`.kiro/specs/daily-challenge/requirements.md`)
- ✅ Updated "Technical Requirements" section (3 tables → 2 tables)
- ✅ Updated "Proposed Solution - Backend" section
- ✅ Updated Task 1 (table schema details)
- ✅ Updated Task 3 (create-daily-challenge logic)
- ✅ Updated Task 7 (admin tools usage)

## Migration Path to SQL

This consolidation maps cleanly to SQL:

```sql
CREATE TABLE daily_challenges (
  challenge_id DATE PRIMARY KEY,
  prompt TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'active', 'completed')),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  total_submissions INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX idx_status ON daily_challenges(status, challenge_id);

CREATE TABLE daily_submissions (
  challenge_id DATE NOT NULL,
  user_id UUID NOT NULL,
  -- ... other fields
  PRIMARY KEY (challenge_id, user_id),
  FOREIGN KEY (challenge_id) REFERENCES daily_challenges(challenge_id)
);
```

## Benefits

1. **Simpler Architecture**: One less table to manage
2. **Single Source of Truth**: All challenge data in one place
3. **SQL-Ready**: Status-based design maps directly to SQL patterns
4. **Clearer Lifecycle**: Prompt → Active → Completed in one record
5. **Atomic Updates**: Challenge activation is a single UPDATE operation
6. **Better Queries**: Can query challenge history with status filters

## Deployment Notes

### New Deployments
- Deploy CDK stack as normal
- Run `add-prompts.ts` to populate initial prompts
- EventBridge will activate challenges daily

### Existing Deployments (Migration Required)
If you have existing data in `rgb-daily-prompts-queue`:

1. Export queued prompts from old table
2. Deploy new CDK stack (creates StatusIndex GSI)
3. Import prompts to challenges table with new schema
4. Verify EventBridge rule works
5. Delete old prompts queue table

## Testing Checklist

- [ ] CDK deploys without errors
- [ ] StatusIndex GSI is created
- [ ] `add-prompts.ts` script adds prompts with status='queued'
- [ ] `create-daily-challenge` Lambda activates queued prompts
- [ ] Fallback prompt works when no queued prompt exists
- [ ] No references to `PROMPTS_QUEUE_TABLE` remain in code
- [ ] All daily challenge endpoints still work correctly
