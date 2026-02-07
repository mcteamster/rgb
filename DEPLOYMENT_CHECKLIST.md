# Daily Challenge Deployment Checklist

Use this checklist to deploy the Daily Challenge feature to production.

## Pre-Deployment

- [ ] Review all code changes in git
- [ ] Run `npm run build` in both `/service` and `/client` directories
- [ ] Test locally if possible (requires AWS credentials)
- [ ] Backup existing DynamoDB tables (if applicable)

## Backend Deployment

### Step 1: Build and Deploy Infrastructure

```bash
cd service
npm install
npm run build
npm run deploy
```

**Expected Output:**
- 3 new DynamoDB tables created
- 5 new Lambda functions deployed
- 1 REST API Gateway created
- 1 EventBridge rule created
- Stack outputs showing:
  - WebSocketApiUrl (existing)
  - **DailyChallengeApiUrl** (NEW - copy this!)

- [ ] CDK deployment successful
- [ ] Copy the `DailyChallengeApiUrl` from output

### Step 2: Verify DynamoDB Tables

Go to AWS Console → DynamoDB → Tables

- [ ] `rgb-daily-challenges` exists
- [ ] `rgb-daily-submissions` exists (with 2 GSIs)
- [ ] `rgb-daily-prompts-queue` exists

### Step 3: Verify Lambda Functions

Go to AWS Console → Lambda → Functions

- [ ] `GetCurrentChallengeFunction` exists
- [ ] `SubmitChallengeFunction` exists
- [ ] `GetLeaderboardFunction` exists
- [ ] `GetUserHistoryFunction` exists
- [ ] `CreateDailyChallengeFunction` exists

### Step 4: Verify API Gateway

Go to AWS Console → API Gateway

- [ ] `RGB Daily Challenge API` exists
- [ ] CORS is enabled for all origins
- [ ] Routes configured:
  - GET /daily-challenge/current
  - POST /daily-challenge/submit
  - GET /daily-challenge/leaderboard/{challengeId}
  - GET /daily-challenge/history/{userId}

### Step 5: Populate Prompts

Edit `service/scripts/add-prompts.ts` to add 7+ days of prompts, then:

```bash
npm run add-prompts
```

- [ ] At least 7 prompts added to queue
- [ ] Verified in DynamoDB console

### Step 6: Create Test Challenge (Optional)

For immediate testing:

```bash
npm run create-challenge -- --date $(date -u +%Y-%m-%d) --prompt "Test Challenge"
```

- [ ] Test challenge created
- [ ] Verified in DynamoDB console

### Step 7: Verify EventBridge Rule

Go to AWS Console → EventBridge → Rules

- [ ] `CreateDailyChallengeRule` exists
- [ ] Schedule: `cron(0 0 * * ? *)`
- [ ] Target: `CreateDailyChallengeFunction`
- [ ] Rule is **Enabled**

## Frontend Deployment

### Step 1: Configure Environment

Edit `client/.env`:

```bash
VITE_DAILY_CHALLENGE_API_URL='<paste-url-from-cdk-output>'
```

- [ ] Environment variable set correctly

### Step 2: Build Frontend

```bash
cd client
npm install
npm run build
```

- [ ] Build completes without errors
- [ ] Check `dist/` folder created

### Step 3: Deploy Frontend

Deploy the `dist/` folder to your hosting provider:

**For Vercel:**
```bash
vercel --prod
```

**For Netlify:**
```bash
netlify deploy --prod --dir=dist
```

**For S3+CloudFront:**
```bash
aws s3 sync dist/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

- [ ] Frontend deployed successfully
- [ ] URL accessible

## Post-Deployment Testing

### Step 1: API Health Check

Test the API directly:

```bash
# Get current challenge (should return 404 if no challenge yet)
curl https://your-api-url/daily-challenge/current?userId=test-123

# Create a test challenge if needed
npm run create-challenge -- --date $(date -u +%Y-%m-%d) --prompt "Test"
```

- [ ] API responds (200 or 404)
- [ ] CORS headers present

### Step 2: Frontend Testing

Visit your deployed site and:

- [ ] Mode selector appears in lobby
- [ ] Clicking "Daily Challenge" loads the container
- [ ] Current challenge displays (or "No challenge available")
- [ ] Color picker works
- [ ] Can enter a name
- [ ] "Submit Color" button works
- [ ] After submission, results screen shows
- [ ] Score and rank display correctly
- [ ] "View Full Leaderboard" works
- [ ] Leaderboard shows all submissions
- [ ] Can navigate back to home

### Step 3: Multi-User Testing

Open the site in multiple browsers/incognito windows:

- [ ] Each gets a unique userId
- [ ] First submission scores 100 points
- [ ] Second submission scores relative to first
- [ ] Leaderboard updates in real-time
- [ ] Ranks are correct
- [ ] Average color calculation makes sense

### Step 4: Error Cases

- [ ] Can't submit twice with same userId
- [ ] Expired challenge rejects submissions
- [ ] Empty name defaults to "Anonymous"
- [ ] Clear localStorage generates new userId

## Monitoring Setup

### CloudWatch Alarms (Optional)

Create alarms for:

- [ ] Lambda errors > 10 in 5 minutes
- [ ] API Gateway 5xx errors > 5%
- [ ] DynamoDB throttles

### Logs

Verify logs are being written:

- [ ] CloudWatch log groups exist for all Lambdas
- [ ] Logs contain useful information (not just errors)

## Rollback Plan

If something goes wrong:

1. **Disable EventBridge Rule**:
   - AWS Console → EventBridge → Rules → CreateDailyChallengeRule → Disable

2. **Remove Routes from Frontend**:
   - Comment out daily challenge routes in `App.tsx`
   - Redeploy frontend

3. **Delete CDK Stack** (if needed):
   ```bash
   npx cdk destroy RgbStack
   ```
   Note: This will delete ALL resources, not just daily challenge!

## Success Criteria

- [ ] Daily challenges create automatically at midnight UTC
- [ ] Users can submit colors successfully
- [ ] Scoring algorithm works correctly
- [ ] Leaderboard displays accurately
- [ ] No errors in CloudWatch logs
- [ ] Frontend loads without console errors
- [ ] All API endpoints respond within 2 seconds

## Post-Launch

- [ ] Monitor CloudWatch logs for 24 hours
- [ ] Check DynamoDB metrics (read/write capacity)
- [ ] Verify EventBridge rule runs successfully
- [ ] Add more prompts to queue (maintain 7+ day buffer)
- [ ] Announce feature to users
- [ ] Document any issues in GitHub

## Notes

- Daily challenges are retained permanently in DynamoDB
- Submissions auto-expire after 30 days (TTL)
- Prompts should be populated 7+ days in advance
- API has no authentication (public access)
- CORS allows all origins (adjust if needed)

## Troubleshooting

**Challenge not appearing:**
- Check DynamoDB for today's challengeId (YYYY-MM-DD)
- Check CreateDailyChallengeFunction logs
- Manually create challenge using script

**API errors:**
- Check Lambda function logs
- Verify environment variables are set
- Check DynamoDB table permissions

**Frontend can't connect:**
- Verify VITE_DAILY_CHALLENGE_API_URL is set
- Check CORS headers in API responses
- Open browser dev tools → Network tab

**Scoring seems wrong:**
- Check Lambda logs for score calculations
- Verify bicone math functions are correct
- Test with known color pairs

## Contact

For support, create an issue in the GitHub repository.
