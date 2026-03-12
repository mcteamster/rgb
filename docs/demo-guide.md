# On the Spectrum — Demo Guide

> 🎮 **[rgb.mcteamster.com](https://rgb.mcteamster.com)** · 5-minute talk · Built in 1 week with Amazon Kiro

---

## 1. The Game

[![On the Spectrum](./img/rgb.jpeg)](https://rgb.mcteamster.com)

**One sentence:** Describe a color in 50 characters — can your friends guess it?

### Two Modes

```mermaid
flowchart LR
  subgraph MP["🎮 Multiplayer — 2–10 players, real-time"]
    A["🎨 Target color generated"] --> B["✍️ Describer writes a clue"]
    B --> C["🖱️ Others drag the color wheel"]
    C --> D["📊 Score = how close you got"]
  end

  subgraph DC["📅 Daily Challenge — Solo, once per day"]
    E["📝 Everyone gets the same prompt"] --> F["🎨 Pick a color that fits"]
    F --> G["📊 Scored vs. the community average"]
    G --> H["🏆 Closer to consensus = more points"]
  end
```

### Live Demo Flow *(3 min)*

1. Open [rgb.mcteamster.com](https://rgb.mcteamster.com) → **Create Game**
2. Share the 4-letter code — players join from anywhere
3. Round starts — the describer sees a target color and types a clue
4. Everyone drags the wheel; you can watch each other's selections move live
5. Reveal — target appears, scores calculated
6. Switch to **Daily Challenge** — show the prompt, pick a color, see the community average

---

## 2. Technology

### Architecture

```mermaid
flowchart TD
  Client["🌐 Browser / Discord App"]

  Client -->|WebSocket| WS["API Gateway\nWebSocket"]
  Client -->|REST| REST["API Gateway\nREST"]

  WS --> L1["⚡ Lambda\ngame logic"]
  REST --> L2["⚡ Lambda\ndaily challenge"]

  L1 --> DB[("DynamoDB\n4 tables · 9 regions")]
  L2 --> DB

  DB --> EB["🕛 EventBridge\ndaily scheduler"]
```

### The Color Wheel

A custom-engineered HTML5 Canvas picker — not a library.

```mermaid
pie showData
  title Wheel surface allocation
  "Playable colors (S:20–100%, L:15–85%)" : 98
  "Near-white ring" : 1
  "Near-black ring" : 1
```

Near-black and near-white are each compressed into a 1% border ring — so 98% of the wheel is the colors that actually appear in the game, giving players maximum precision where it matters.

### Scoring

**Multiplayer** — geometric normal distribution, weighted by HSL component:

```mermaid
flowchart LR
  H["Hue ×6"] --> WGM["Weighted\nGeometric Mean"]
  S["Saturation ×1"] --> WGM
  L["Lightness ×2"] --> WGM
  WGM --> Score["🎯 Score 0–100"]
  WGM -->|"Beyond 3σ in any component"| Zero["💀 0 points"]
```

**Daily Challenge** — Euclidean distance in 3D color space:

```mermaid
flowchart TD
  HSL["HSL Color"] --> Bicone["Bicone space\nx, y, z coords"]
  Bicone -->|"HSL mapped to a 3D double cone\nso distances are perceptually uniform"| Dist["Distance from\ncommunity average"]
  Dist --> Score["Score = 100 × (1 − distance / √2)"]
```

### 9 Regions, One Game Code

The last two characters of every game code encode the AWS region. The client auto-detects the closest region and routes players there automatically.

```mermaid
flowchart LR
  Code["Game code\ne.g. XYZS"] --> Last["Last 2 chars\n= region"]

  Last --> AU["BC → Australia"]
  Last --> JP["DF → Japan"]
  Last --> SG["GH → Singapore"]
  Last --> IN["JK → India"]
  Last --> EU["LM → Europe"]
  Last --> UK["NP → UK"]
  Last --> BR["QR → Brazil"]
  Last --> USE["ST → US East"]
  Last --> USW["VW → US West"]
```

---

## 3. Built with Amazon Kiro

### What Is Kiro?

[Amazon Kiro](https://kiro.dev) is an AI-powered IDE that introduces **spec-driven development** — you write structured requirements first, and Kiro uses them as persistent context for every code generation request.

### How It Worked

```mermaid
flowchart TD
  subgraph kiro[".kiro/ folder"]
    subgraph steering["steering/ — always-on context"]
      G["GAMEPLAY.md\ngame rules & scoring"]
      ST["STRUCTURE.md\narchitecture & patterns"]
      TC["TECHNICAL_CONSTRAINTS.md\ncolor precision, AWS limits"]
    end
    subgraph specs["specs/ — task-by-task feature plans"]
      SR["service/requirements.md\nmultiplayer backend"]
      CR["client/requirements.md\nHSL color wheel"]
      DR["daily-challenge/requirements.md\nWordle-style mode"]
    end
  end

  kiro --> Gen["⚡ Kiro generates code\nwith full design context\non every request"]
```

**Steering docs** — Kiro reads these before every task. Game rules, scoring weights, architectural decisions are never "forgotten" between sessions.

**Spec docs** — each feature is planned as numbered tasks with explicit acceptance criteria before a line of code is written.

### What Kiro Built

| Feature | Time |
|---------|------|
| CDK stack + DynamoDB tables | Hours |
| WebSocket game logic (13 actions) | Hours |
| Custom color wheel (Canvas) | Hours |
| Daily challenge (5 Lambdas + REST API + UI) | ~2 days |
| **Total** | **~1 week** |

### Human vs Kiro

| Human | Kiro |
|-------|------|
| Game design & rules | Implemented the rules in code |
| Scoring algorithm math | Implemented the algorithm |
| UX decisions | Built the components |
| Spec writing | Followed the spec |
| Playtesting & balance | Generated consistent output |

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
