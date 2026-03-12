# On the Spectrum — Demo Guide

> 🎮 **rgb.mcteamster.com** · 5-minute talk · Built in 1 week with Amazon Kiro

---

## 1. The Game

[![On the Spectrum](./img/rgb.jpeg)](https://rgb.mcteamster.com)

**One sentence:** Describe a color in 50 characters — can your friends guess it?

### Two Modes

```
MULTIPLAYER                          DAILY CHALLENGE
───────────────────────────────      ───────────────────────────────
2–10 players, real-time              Solo, once per day (like Wordle)

  🎨 Target color generated            📝 Everyone gets same prompt
         ↓                                      ↓
  ✍️  Describer writes a clue          🎨 Pick a color that fits
         ↓                                      ↓
  🖱️  Others drag the color wheel      📊 Scored vs community average
         ↓                                      ↓
  📊 Score = how close you got        🏆 Closer to consensus = more points
```

### Live Demo Flow *(3 min)*

1. Open [rgb.mcteamster.com](https://rgb.mcteamster.com) → **Create Game**
2. Share the 4-letter code → players join
3. Round starts — describer sees a color, types a clue
4. Everyone drags the wheel in real-time (watch each other's selections move live!)
5. Reveal — target appears, scores calculated
6. Switch to **Daily Challenge** — show prompt, pick a color, see community average

---

## 2. Technology

### Architecture

```
  Browser / Discord App
         │
         ├──── WebSocket ────► API Gateway ──► Lambda
         │                                       │
         └──── REST API ─────► API Gateway ──► Lambda
                                                 │
                                            DynamoDB
                                         (4 tables, 9 regions)
                                                 │
                                     EventBridge (daily scheduler)
```

### The Color Wheel

A custom-engineered HTML5 Canvas picker — not a library.

```
         White (compressed to thin ring)
                  ●
           ╭─────────────╮
          ╱    Playable   ╲       98% of wheel surface =
         │   color space   │  ◄── the colors that actually
         │   (S:20-100%    │      appear in the game
          ╲  L:15-85%)    ╱
           ╰─────────────╯
                  ●
         Black (compressed to thin ring)
```

Near-black and near-white are each squashed into a 1% border ring — giving players maximum precision where it matters.

### Scoring

**Multiplayer** — geometric normal distribution, weighted by component:

```
  Hue ×6   Saturation ×1   Lightness ×2
     ↘            ↓            ↙
      Weighted geometric mean
             = Score (0–100)

  Beyond 3σ from target in any component → 0 points
```

**Daily Challenge** — Euclidean distance in 3D color space:

```
     HSL Color
         │
         ▼
    Bicone space         ← HSL mapped to a 3D double cone
    (x, y, z coords)       so color distances are perceptually uniform
         │
         ▼
  Distance from           Score = 100 × (1 - distance/√2)
  community average  ──►  Closer to consensus = higher score
```

### 9 Regions, One Game Code

```
  Game code:  X Y Z S
                    └── Region indicator
                         BC=Australia  DF=Japan   GH=Singapore
                         LM=Europe     NP=UK      ST=US East
                         VW=US West    QR=Brazil  JK=India
```

Client auto-detects the closest region — players are always routed to the fastest server.

---

## 3. Built with Amazon Kiro

### What Is Kiro?

An AI-powered IDE that uses **specs** and **steering docs** to guide code generation — structured intent, not just prompts.

### How It Worked

```
  ┌─────────────────────────────────────────────────┐
  │              .kiro/ folder                      │
  │                                                 │
  │  steering/          specs/                      │
  │  ─────────          ──────                      │
  │  GAMEPLAY.md        service/requirements.md     │
  │  STRUCTURE.md       client/requirements.md      │
  │  TECHNICAL_         daily-challenge/            │
  │  CONSTRAINTS.md       requirements.md           │
  │                                                 │
  │  Always-on context  Task-by-task feature plans  │
  └─────────────────────────────────────────────────┘
                         │
                         ▼
               Kiro generates code
               with full design context
               on every request
```

**Steering docs** = persistent context (game rules, architecture, constraints) — Kiro reads these before every task so nothing is "forgotten" between sessions.

**Spec docs** = feature blueprints — problem statement, requirements, numbered tasks, and explicit *"how you know it's done"* criteria for each.

### What Kiro Built

| Feature | Time |
|---------|------|
| CDK stack + DynamoDB tables | Hours |
| WebSocket game logic (13 actions) | Hours |
| Custom color wheel (Canvas) | Hours |
| Daily challenge (5 Lambdas + REST API + UI) | ~2 days |
| **Total** | **~1 week** |

### Human vs AI

```
  HUMAN                          KIRO
  ─────────────────────          ─────────────────────────────
  Game design & rules            Implemented the rules in code
  Scoring algorithm math         Implemented the algorithm
  UX decisions                   Built the components
  Spec writing                   Followed the spec
  Playtesting & balance          Generated consistent output
```

> **The spec is the contract.** When output was wrong, the fix was almost always in the spec — not the code.

---

## Quick Reference

| | |
|--|--|
| **Play** | [rgb.mcteamster.com](https://rgb.mcteamster.com) |
| **Repo** | [github.com/mcteamster/rgb](https://github.com/mcteamster/rgb) |
| **Stack** | React · TypeScript · AWS CDK · Lambda · DynamoDB |
| **Regions** | 9 AWS regions |
| **Built in** | ~1 week · Amazon Kiro · re:Invent 2025 |
