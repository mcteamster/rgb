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
    F --> G["📊 Scored vs. community average"]
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
  Client -->|WebSocket| WS["API Gateway WebSocket"]
  Client -->|REST| REST["API Gateway REST"]
  WS --> L1["⚡ Lambda — game logic"]
  REST --> L2["⚡ Lambda — daily challenge"]
  L1 --> DB[("DynamoDB — 4 tables · 9 regions")]
  L2 --> DB
  DB --> EB["🕛 EventBridge — daily scheduler"]
```

### The Color Wheel

A custom-engineered HTML5 Canvas picker — not a library.

![Color wheel tips modal](./img/color-picker-tips.png)

> **Live demo** — show the color wheel in action.

### Scoring

**Multiplayer** — geometric normal distribution, weighted by HSL component:

```mermaid
flowchart LR
  H["Hue ×6"] --> WGM["Weighted Geometric Mean"]
  S["Saturation ×1"] --> WGM
  L["Lightness ×2"] --> WGM
  WGM --> Score["🎯 Score 0–100"]
  WGM -->|"Beyond 3σ in any component"| Zero["💀 0 points"]
```

**Daily Challenge** — Euclidean distance through the HSL double cone:

HSL is mapped to a 3D double cone (bicone) so that distances between colors are perceptually uniform:

![HSL double cone](https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/HSL_color_solid_dblcone_chroma_gray.png/320px-HSL_color_solid_dblcone_chroma_gray.png)

```mermaid
flowchart TD
  HSL["HSL Color"] --> Bicone["Bicone coordinates — x, y, z"]
  Bicone --> Dist["Euclidean distance from community average"]
  Dist --> Score["Score = 100 × (1 − distance / √2)"]
```

The community average is updated in real-time using **Welford's online algorithm** — no need to store every submission.

### 9 Regions, One Game Code

The last two characters of every game code encode the AWS region. Region selection is handled by **[Virgo](https://virgo.tonz.io)** ([mcteamster/virgo](https://github.com/mcteamster/virgo)) — a lightweight browser library that picks the nearest server from the player's device timezone, with no GPS, no IP lookup, and no external requests.

```mermaid
flowchart LR
  TZ["🕐 Device Timezone"] --> Virgo["Virgo\nvirgo.tonz.io"]
  Virgo -->|"nearest region"| Code["Game code e.g. XYZS"]
  Code --> Last["Last 2 chars = region"]
  Last --> AU["🇦🇺 BC — Australia"]
  Last --> JP["🇯🇵 DF — Japan"]
  Last --> SG["🇸🇬 GH — Singapore"]
  Last --> IN["🇮🇳 JK — India"]
  Last --> EU["🇪🇺 LM — Europe"]
  Last --> UK["🇬🇧 NP — UK"]
  Last --> BR["🇧🇷 QR — Brazil"]
  Last --> USE["🇺🇸 ST — US East"]
  Last --> USW["🇺🇸 VW — US West"]
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
      G["GAMEPLAY.md — game rules and scoring"]
      ST["STRUCTURE.md — architecture and patterns"]
      TC["TECHNICAL_CONSTRAINTS.md — color precision, AWS limits"]
    end
    subgraph specs["specs/ — task-by-task feature plans"]
      SR["service/requirements.md — multiplayer backend"]
      CR["client/requirements.md — HSL color wheel"]
      DR["daily-challenge/requirements.md — Wordle-style mode"]
    end
  end
  kiro --> Gen["⚡ Kiro generates code with full design context on every request"]
```

**Steering docs** — Kiro reads these before every task. Game rules, scoring weights, and architectural decisions are never forgotten between sessions.

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
| Game design and rules | Implemented the rules in code |
| Scoring algorithm math | Implemented the algorithm |
| UX decisions | Built the components |
| Spec writing | Followed the spec |
| Playtesting and balance | Generated consistent output |

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
