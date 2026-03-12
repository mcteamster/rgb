# On the Spectrum — Demo Guide

A presentation guide covering gameplay, technology, and how the project was built using AI-assisted spec-driven development with Amazon Kiro.

---

## 1. The Game

### What Is It?

**On the Spectrum** is a multiplayer color guessing party game, playable inside Discord or any browser at [rgb.mcteamster.com](https://rgb.mcteamster.com).

Inspired by the board game *Hues and Cues*, it asks a simple question: **can you describe a color in 50 characters or less, and can your friends guess which one you mean?**

The twist — colors are defined with mathematical precision. There's no "reddish-orange" — there's a specific HSL value, and you're scored on exactly how close you get.

### Two Game Modes

**Multiplayer (2–10 players, real-time)**
- A random color is secretly generated for the describer
- They write a clue in 50 characters (a word, emoji, hex code, a feeling — anything)
- Other players drag a color wheel to their best guess
- Scores are based on mathematical distance in color space
- Roles rotate until everyone has described their allocated turns

**Daily Challenge (solo, asynchronous)**
- A text prompt is shown to all players worldwide (e.g. *"The color of a rainy day"*)
- Players each pick a color — once, no take-backs
- You're scored against the **community average** — closer to the consensus = higher score
- Think Wordle, but with color and no fixed correct answer

### Demo Flow

A good live demo covers the full multiplayer round cycle:

1. **Create a game** — show room creation, share the 4-character game code
2. **Players join** — show the regional game code encoding (e.g. `XYZS` = US East)
3. **Start a round** — the describer sees their target color, everyone else sees the prompt
4. **Describe it** — type something creative; watch the typing state in real-time
5. **Guessing phase** — show the color wheel; other players' draft selections are visible live
6. **Reveal** — target color appears, scores calculated, leaderboard updates
7. **Switch to Daily Challenge** — show the prompt, submit a color, see the community average

### What Makes It Interesting?

- **No "correct" answer in the Daily Challenge** — the community *becomes* the answer, Wordle-style
- **Color wheel precision** — a custom-engineered HSL picker that compresses near-black/white into a small ring so the playable range fills the wheel
- **Scoring is brutal** — beyond 3 standard deviations from the target in any color component: 0 points
- **Real-time draft visibility** — you can watch other players' color selections move in real-time during the guessing phase

---

## 2. Technology

### Architecture at a Glance

```
Browser / Discord App
        │
        ├── WebSocket ──► API Gateway ──► Lambda (game logic)
        │                                       │
        └── REST API ───► API Gateway ──► Lambda (daily challenge)
                                                │
                                           DynamoDB (4 tables)
                                           S3 (analytics)
                                           EventBridge (daily scheduler)
```

### Frontend — React + TypeScript + Vite

Deployed as a Discord Embedded App and standalone web app.

**Key engineering decisions:**

- **Custom HSL color wheel** — HTML5 Canvas, not a library. The wheel maps the playable color space (S: 20–100%, L: 15–85%) to 98% of the visible surface, compressing extremes (near-black, near-white) to a thin 1% border ring. This gives players maximum precision over the colors that actually appear in the game.

- **Saturation curve**: `Math.pow((-sin(angle) + 1) / 2, 0.2) × 100` — a custom sine-based function that allocates more visual space to highly saturated colors.

- **Lightness curve**: `Math.pow(1 - normalizedDistance, 3/4)` — a power function that emphasises mid-to-high lightness, matching the game's generated color range.

- **Discord SDK integration** — the app runs natively inside Discord's activity panel using the [Discord Embedded App SDK](https://discord.com/developers/docs/activities/overview), with automatic region detection for low-latency WebSocket connections.

### Backend — AWS Serverless (CDK + Lambda + DynamoDB)

Deployed across **9 AWS regions** for global low-latency play.

| Component | Purpose |
|-----------|---------|
| `API Gateway (WebSocket)` | Real-time multiplayer messaging |
| `API Gateway (REST)` | Daily challenge CRUD |
| `Lambda (connect/disconnect/message)` | WebSocket game logic |
| `Lambda (5 REST functions)` | Daily challenge API |
| `DynamoDB (Games)` | Multiplayer game state, 12hr TTL |
| `DynamoDB (Connections)` | WebSocket connection → game mappings |
| `DynamoDB (Challenges)` | Daily prompt queue and active challenges |
| `DynamoDB (Submissions)` | User daily challenge submissions |
| `EventBridge` | Triggers daily challenge creation at UTC midnight |
| `DynamoDB Streams → S3` | Analytics pipeline |

**Regional game codes** — the 4-character game code (e.g. `XYZS`) encodes the AWS region in the last character pair. The client auto-detects the closest region using latency probing and routes players there automatically.

| Code | Region |
|------|--------|
| BC | Australia (ap-southeast-2) |
| DF | Japan (ap-northeast-1) |
| GH | Singapore (ap-southeast-1) |
| JK | India (ap-south-1) |
| LM | Europe (eu-central-1) |
| NP | UK (eu-west-2) |
| QR | Brazil (sa-east-1) |
| ST | US East (us-east-1) |
| VW | US West (us-west-2) |

### Scoring Algorithms

**Multiplayer — Geometric Normal Distribution**

Each color component (hue, saturation, lightness) is scored independently using a normal distribution, then combined as a weighted geometric mean:

```
score = 100 × (hueExp^6 × satExp^1 × lightExp^2)^(1/9)
```

- Hue weight: 6.0 — the most perceptually important component
- Saturation weight: 1.0
- Lightness weight: 2.0
- **3-sigma cutoff**: any component too far from target = 0 points (no partial credit)
- **Dynamic adjustments**: hue tolerance widens for near-black/white (where hue becomes less meaningful); lightness tolerance scales with target lightness

**Daily Challenge — Bicone Euclidean Distance**

HSL colors are converted to 3D Cartesian coordinates in the HSL double-cone (bicone) geometry, then scored by Euclidean distance from the community average:

```typescript
const radius = (s / 100) * Math.min(l, 100 - l) / 50;
const x = radius * Math.cos(hueRad);
const y = radius * Math.sin(hueRad);
const z = (l - 50) / 50;

score = 100 × (1 - distance / √2)
```

Community averages are updated incrementally using **Welford's online algorithm** — O(1) updates, no need to store all submissions or recompute from scratch.

### Concurrency & Reliability

- **DynamoDB conditional writes** prevent race conditions when multiple players submit simultaneously
- **Automatic deadline enforcement** — server-side timers advance game phases when time limits expire; draft colors are auto-submitted for players who don't respond in time
- **WebSocket reconnection** — exponential backoff (1s → 30s max), message queuing during reconnect, automatic rejoin on restore
- **5-second sync polling** — client polls `getGame` every 5 seconds as a backstop against missed WebSocket events

---

## 3. AI-Assisted Development with Amazon Kiro

### What Is Kiro?

[Amazon Kiro](https://kiro.dev) is an AI-powered IDE (built on VS Code) that introduces **spec-driven development** — a structured workflow where you write requirements first, and Kiro uses those specs to guide code generation with context.

*On the Spectrum* was built **in one week** using Kiro CLI with 1,000 credits from Amazon re:Invent 2025.

### How Spec-Driven Development Works

Rather than prompting an AI with vague instructions, Kiro's approach is:

```
Requirements → Spec → Steered Generation → Implementation
```

**1. Steering Documents** (`.kiro/steering/`)

Always-on context files that ground every code generation request. Think of them as a persistent "system prompt" that Kiro reads before every task.

*On the Spectrum* uses three steering documents:

| File | Purpose |
|------|---------|
| `GAMEPLAY.md` | Complete game rules, phase transitions, scoring logic, edge cases |
| `STRUCTURE.md` | Monorepo layout, technology choices, architectural patterns |
| `TECHNICAL_CONSTRAINTS.md` | Color space precision requirements, browser support, AWS constraints, security rules |

These files mean that every code generation request — no matter how isolated — has the full game design and architecture as context. Kiro doesn't "forget" that hue has a weight of 6.0, or that the describer gets the average of guesser scores.

**2. Spec Documents** (`.kiro/specs/`)

Feature-level implementation plans broken into numbered tasks. Before any code is written, the spec defines:

- The problem statement
- Requirements and constraints
- A task-by-task breakdown with explicit subtasks
- Demo criteria for each task (how you know it's done)

Three specs were written for *On the Spectrum*:

**`service/requirements.md`** — the initial multiplayer backend:
> "Build a digital online color guessing game using AWS serverless architecture... Full AWS serverless stack (API Gateway WebSocket API + Lambda + DynamoDB)"

Broken into 4 tasks: CDK infrastructure → WebSocket API → game logic Lambdas → frontend integration.

**`client/requirements.md`** — the HSL color wheel:
> "Implement a high-resolution HSV color picker wheel... Canvas-based rendering in TypeScript React... High resolution (256×256 equivalent precision)"

**`daily-challenge/requirements.md`** — the Wordle-mode feature:
> "Add a single-player daily challenge mode... Players are scored based on how close their color choice is to the average of all submissions... dynamic scoring: players score against the average of all submissions at the time they submit"

This spec alone is ~200 lines detailing 8 tasks, covering backend tables, scoring algorithms, Lambda functions, frontend context, UI components, admin tools, testing, and a deployment checklist.

### What Kiro Did Well

**Consistency across a complex codebase** — with steering docs active, generated code never drifted from established patterns. Lambda functions followed the same error handling style. TypeScript interfaces were consistent. The `HSLColor` type appeared the same way in every file.

**Spec as documentation** — the requirement specs are living documents. They capture *why* decisions were made (e.g. why bicone geometry for daily challenge scoring, why geometric mean for multiplayer). Future contributors — or AI sessions — can read the spec to understand intent, not just code.

**Task decomposition** — breaking a feature into 7–8 numbered tasks with explicit demo criteria made it possible to ship a working daily challenge mode incrementally, verifying each layer before building the next.

**Rapid prototyping** — a full serverless backend (CDK stack, DynamoDB tables, 5 Lambda functions, EventBridge scheduler) was scaffolded and deployed in hours rather than days.

### What Required Human Judgment

- **Scoring algorithm design** — the specific weights (Hue: 6.0, Sat: 1.0, Light: 2.0) and sigma values emerged from playtesting, not spec generation. Kiro could implement a scoring function given a formula, but couldn't derive the formula from "this feels fair."
- **Color wheel UX** — the decision to compress near-black/near-white to 1% of the wheel radius while dedicating 98% to the playable range required understanding what *players* would find frustrating. That insight came from human experience.
- **Game balance** — the 3-sigma cutoff, the describer bonus formula, and the bias toward not repeating the same describer back-to-back were all judgment calls refined through play.

### The Workflow in Practice

```
1. Play the board game → identify which mechanics to digitise
2. Write steering docs → codify the design in structured markdown
3. Write a spec → break the feature into concrete tasks with clear acceptance criteria
4. Kiro generates → task by task, with steering context always present
5. Human reviews → test the demo criteria, adjust spec if needed
6. Iterate → refine steering docs as the design evolves
```

The spec becomes the contract between human intent and AI execution. When something is wrong, the fix is usually in the spec — clarify the requirement, not just the code.

### Takeaways

- **Specs pay dividends** — the time invested in writing a thorough spec is repaid in generated code that needs less correction and review
- **Steering docs are force multipliers** — consistent context means consistent output across a large codebase
- **AI excels at implementation, humans at design** — the architectural decisions, game balance, and UX choices were human; the code that expressed them was AI-assisted
- **One week is achievable** — with spec-driven development, a solo developer shipped a full-stack multiplayer game with a custom scoring algorithm, custom color picker, serverless infrastructure across 9 regions, and a daily challenge mode in 7 days

---

## Appendix: Quick Reference

### Live URLs
- **Game**: [rgb.mcteamster.com](https://rgb.mcteamster.com)
- **Repository**: [github.com/mcteamster/rgb](https://github.com/mcteamster/rgb)

### Tech Stack Summary
| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Discord Embedded App SDK |
| Backend | AWS CDK, Lambda (Node.js 24), API Gateway (WS + REST) |
| Database | DynamoDB (4 tables) |
| Infrastructure | 9 AWS regions, EventBridge, DynamoDB Streams, S3 |
| AI Tooling | Amazon Kiro (spec-driven development) |

### Key Numbers
| Metric | Value |
|--------|-------|
| Development time | ~1 week |
| AWS regions | 9 |
| Max players per game | 10 |
| Daily challenge window | 24 hrs (UTC midnight) |
| Score range | 0–100 points |
| Multiplayer scoring | Geometric normal distribution |
| Daily scoring | Bicone Euclidean distance |
| Lambda cold start target | < 1 second |
| Concurrent connection target | 1,000+ |
