# Daily Game Design Patterns

Research-backed design patterns for daily puzzle games, applied to *On the Spectrum*.

---

## Overview

The daily puzzle genre — popularised by Wordle in late 2021 — has evolved into a mature design category with well-documented mechanics and psychological principles. This document summarises the patterns most relevant to *On the Spectrum* as a daily color-guessing challenge.

---

## 1. Core Engagement Mechanics

### The One-Per-Day Constraint

The single most defining mechanic of this genre is the hard limit of **one puzzle per day, shared across all players**. Wordle creator Josh Wardle described this as his key breakthrough:

> "I think people kind of appreciate that there's this thing online that's just fun. It's something that encourages you to spend three minutes a day. Like, it doesn't want any more of your time than that."

This works through several psychological mechanisms:

- **Artificial scarcity**: A puzzle that expires in 24 hours is perceived as more valuable than one available indefinitely
- **Habit formation over bingeing**: The daily limit forces players into a return loop rather than a single long session
- **FOMO activation**: Missing a day means missing an irreplaceable puzzle — the Zeigarnik Effect (anxiety over incomplete tasks) makes skipped days feel like unfinished business
- **Ritual formation**: Because the puzzle resets at midnight UTC, players build daily routines around it — morning coffee, commute, lunch break

*On the Spectrum* follows this pattern: one daily challenge per UTC day, non-repeatable, with results scored against that day's community average.

### Calibrated Difficulty and Universal Participation

A key design principle is that the game must be **equally engaging across skill levels**. If skilled players find it trivially easy or unskilled players find it impossible, the shared-experience community collapses.

For *On the Spectrum*, this means the scoring spectrum should feel meaningful at all ends — a near-perfect color match should feel exceptional, while a wide miss should still feel like a worthy attempt rather than a failure.

---

## 2. Scoring and Feedback Patterns

### Immediate, Unambiguous Feedback

The best daily games provide feedback that is:

- **Instant**: Feedback fires the moment a guess is confirmed
- **Unambiguous**: No interpretation required
- **Cumulative**: Each guess adds information, narrowing the solution space
- **Honest**: The scoring reflects actual proximity to the target, not an arbitrary threshold

*On the Spectrum* uses **bicone Euclidean distance** to score daily submissions — a perceptually meaningful measure of how close a submitted color is to the community average in 3D color space. See [hsl-color-scoring.md](./hsl-color-scoring.md) for the full algorithm.

### Personal Statistics

Wordle popularised the in-game stats panel as a long-term engagement driver. Key metrics for a daily color game:

| Metric | Purpose |
|--------|---------|
| Total games played | Validates investment |
| Win rate | Persistent performance metric |
| Current streak | Daily emotional stakes |
| Max streak (all-time) | Permanent achievement, survives streak breaks |
| Score distribution | Shows skill improving over time |
| Best score | Personal benchmark |
| Average score | Self-comparison baseline |

*On the Spectrum* currently tracks: `totalPlayed`, `averageScore`, `bestScore`, and `currentStreak` via the `/daily-challenge/history/{userId}` endpoint.

### Score as Narrative

The most satisfying scoring systems in this genre **tell a story**, not just a number. A 98/100 in *On the Spectrum* isn't just "good" — it's "I almost nailed the exact hue the community converged on." The score becomes a shareable identity signal.

---

## 3. Social and Sharing Mechanics

### The Spoiler-Free Share Card

Wordle's viral emoji grid was the genre's breakthrough sharing mechanic. Its defining properties:

- **Spoiler-free**: Shows the pattern of guesses without revealing the answer
- **Visually distinctive**: A block of colored squares stands out in a social feed
- **Tells a micro-story**: Each grid is unique and communicates something about the experience
- **Invites comparison without ranking**: The format prompts "How did you do?" without direct hostility

At its peak, Wordle generated **500,000 tweets per day**. Between January 1–13, 2022, 1.2 million Wordle results were shared on Twitter.

**For *On the Spectrum***, a share card could show:
- A row of color swatches representing each past daily guess (without revealing the target)
- Today's puzzle number (e.g., "Day 247")
- Final score (e.g., "94/100")
- Current streak

The target color itself should **not** be in the share card — this preserves spoiler-free sharing and gives undiscovered players incentive to try the puzzle themselves.

### The Puzzle Number as Shared Identity Marker

Games like Wordle use sequential puzzle numbering (e.g., "Wordle 247") to give each puzzle a **shared timestamp**. "Day 247" in *On the Spectrum* means something specific — a specific color prompt, on a specific day, experienced by the whole community simultaneously. This creates shared history and makes individual solves part of a larger collective narrative.

---

## 4. Accessibility and Archive Design

### Colorblind Accessibility

This is especially critical for a color-based game. Wordle offers a High Contrast Mode; *On the Spectrum* should consider:

- **Never rely on color alone** to communicate feedback — pair color with text labels, numbers, or shapes
- **Offer alternative feedback modes**: e.g., HSL component dials or a numeric Delta-E score alongside visual swatches
- **Test against common colorblindness types**: deuteranopia (red-green), protanopia (red), and tritanopia (blue-yellow)

### One Attempt Per Day

The design consensus is firm: **each player gets one attempt**. Allowing replays destroys the scarcity mechanic and means some players will have solved it multiple times before discussing it with others, undermining the shared-experience dynamic.

### Archive Access

The NYT's 2024 launch of a Wordle archive of 1,000+ past puzzles established the model:

- **Archive access is a premium/subscriber feature** — free players get the daily puzzle, paying subscribers get history
- **Archive play does not affect streaks or statistics** — preserving the integrity of streaks as a record of genuine daily engagement
- **Past challenges become browseable content**, giving subscribers additional value

*On the Spectrum* currently supports fetching past challenges via `/daily-challenge/by-date/{date}` (up to 30 days). Extending this into a structured archive with calendar UI is a natural next step.

---

## 5. Retention Mechanics

### Streak Design

Duolingo's streak research provides the most rigorous data available:

- Users who reach a **7-day streak** are **3.6× more likely** to continue long-term
- **Loss aversion** drives streaks more than positive motivation — Kahneman & Tversky established that losing something is psychologically ~2× as painful as gaining an equivalent reward
- Introducing a **Streak Freeze** reduced churn by **21%** for at-risk users and increased daily active users by **+0.38%**
- Making streaks *easier* to maintain increased long-term engagement

Key principles:

- Show streak prominently, but not shamefully on day zero
- **Offer streak protection** (a freeze, grace day, or vacation mode) — now an industry standard
- **Distinguish current streak from max streak**: current creates daily stakes; max is an all-time record that persists even after a miss
- Mark milestones at 7, 30, 100, 365 days with a distinct visual or moment

*On the Spectrum* tracks `currentStreak` (resets on a missed day). Max streak and streak protection are future additions.

### The Cautionary Tale: Heardle

Heardle's collapse after Spotify's 2022 acquisition is the genre's most instructive post-mortem:

- **Stats wipe**: Personal statistics and streaks were erased during migration — monthly unique visitors fell from **41 million to 6 million in 8 months** (an 85% collapse)
- **Friction at the reward moment**: After a correct guess, Spotify redirected users to the app instead of playing the full song — introducing friction precisely at the moment of triumph
- **Geographic blocking**: International players were locked out without warning

The lesson: streak data and personal statistics are not decorative. They are a core part of the player's investment. Destroying them is equivalent to destroying the product.

---

## 6. Community Dynamics

### The Shared Puzzle as Synchronized Social Event

All players worldwide attempt the same puzzle on the same day. This creates:

- **Common reference point**: "Did you get today's?" becomes a universal conversation opener
- **Temporal solidarity**: Everyone is at the same moment — discussing the challenge on Tuesday means talking to thousands of people who faced the same thing at the same time
- **Collective difficulty experiences**: When a particularly unusual color comes up, everyone is challenged simultaneously — shared frustration becomes community bonding
- **Viral amplification**: Group chats, Slack channels, and social threads emerge organically because the shared puzzle is a natural social catalyst

In 2024, Wordle was played **5.3 billion times**, Connections **3.3 billion times**, and Strands **1.3 billion times** — all within a single year. NYT Games now has **over 9 million dedicated subscribers**.

### Puzzle Variety Drives Discussion

Difficulty should vary deliberately. Easy days build confidence and broaden the community; hard days generate discussion, commiseration, and memorable "that was rough" shared moments. Both serve retention.

For *On the Spectrum*, this maps to the range of color prompts: a vivid, saturated primary colour is easy to converge on; a subtle, low-saturation grey-green with an ambiguous prompt is a "hard day" that everyone remembers.

---

## 7. Psychological Principles Underlying the Design

| Principle | Application |
|-----------|-------------|
| **Loss aversion** (Kahneman & Tversky) | Losing a streak hurts ~2× more than gaining a day feels good — streaks are emotionally asymmetric |
| **Variable reinforcement** | The uncertainty of today's difficulty creates a reinforcement schedule that resists extinction |
| **Zeigarnik Effect** | Missed days create cognitive "open loops" that motivate return |
| **Scarcity principle** | The 24-hour window makes each puzzle feel more significant |
| **Social comparison** | Seeing others' results activates competitive and communal instincts simultaneously |

---

## Recommendations for On the Spectrum

Based on the above patterns, the highest-leverage improvements for the daily challenge mode:

### Near-term
- [ ] **Max streak tracking**: Persist all-time best streak separately from current streak
- [ ] **Puzzle number display**: Show sequential Day N identifier on each challenge
- [ ] **Spoiler-free share card**: Auto-generated card with guess swatches, score, and streak — but not the target color

### Medium-term
- [ ] **Streak protection**: One free "freeze" per week or grace period for first missed day
- [ ] **Colorblind accessibility**: Alternative feedback mode with numeric HSL distance values
- [ ] **Milestone celebrations**: Visual moment at 7, 30, 100-day streaks

### Longer-term
- [ ] **Extended archive**: Calendar view beyond 30 days, separated from streak stats
- [ ] **Difficulty variation**: Intentional range in prompt ambiguity to drive community discussion
- [ ] **Thematic/seasonal puzzles**: Event-based shared moments (holidays, notable dates)

---

## References

- [The Rise of Once-a-Day Games — Game Developer](https://www.gamedeveloper.com/design/the-rise-of-once-a-day-games-lessons-learned-from-wordle-s-legacy)
- [How Wordle Won the Internet — Webflow](https://webflow.com/blog/wordle-design)
- [From Viral Success to Losing Steam — MoEngage](https://www.moengage.com/blog/wordle-viral-growth-story/)
- [How Duolingo Streak Builds Habit — Duolingo Blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)
- [The Psychology Behind Duolingo's Streak Feature](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature)
- [Inside Spotify's Acquisition of Heardle — Startup Spells](https://startupspells.com/p/spotify-acquisition-heardle-wordle-clone)
- [NYT Games: The Daily Puzzle Phenomenon — Ivey HBA](https://www.ivey.uwo.ca/hba/blog/2025/03/the-daily-puzzle-phenomenon-how-nyt-turned-games-into-a-subscription-goldmine/)
- [Wordle Statistics — GameTrust](https://www.gametrust.org/wordle-stats/)
