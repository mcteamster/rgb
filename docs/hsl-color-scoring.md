# Scoring in the HSL Color Space

## Overview

Contrary to the name of the repo, On the Spectrum does not use RGB to calculate color distance. Instead we use HSL (Hue, Saturation, Lightness) - a color space that represents colors in a way that aligns with human color perception. HSL separates color identity by its visual properties.

## HSL Components

### Hue (H): 0-360°
- **Definition**: The color type on the color wheel
- **Range**: 0-360 degrees (wraps around)
- **Key Points**:
  - 0° = Red
  - 60° = Yellow  
  - 120° = Green
  - 180° = Cyan
  - 240° = Blue
  - 300° = Magenta
  - 360° = Red (same as 0°)

### Saturation (S): 0-100%
- **Definition**: Color intensity or purity
- **Range**: 0-100 percent
- **Behavior**:
  - 0% = Completely desaturated (grayscale)
  - 50% = Moderately saturated
  - 100% = Fully saturated (vivid color)

### Lightness (L): 0-100%
- **Definition**: Brightness level of the color
- **Range**: 0-100 percent
- **Behavior**:
  - 0% = Black (no light)
  - 50% = Pure color at full saturation
  - 100% = White (maximum light)

## Double Cone Geometry

The HSL color space forms a **double cone** (bicone) when visualized in three dimensions:

![HSL Double Cone](https://upload.wikimedia.org/wikipedia/commons/2/2d/HSL_color_solid_dblcone.png)
*HSL color space represented as a double cone. Image: [SharkD](https://commons.wikimedia.org/wiki/User:SharkD), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)*

### Geometric Properties

**Vertical Axis (Lightness)**:
- Bottom point: Black (L=0%, S=0%)
- Middle section: Pure colors (L=50%, S=0-100%)
- Top point: White (L=100%, S=0%)

**Radial Distance (Saturation)**:
- Center axis: Grayscale colors (S=0%)
- Outer edge: Fully saturated colors (S=100%)
- Radius varies with lightness level

**Angular Position (Hue)**:
- 360° rotation around vertical axis
- Consistent across all lightness levels
- Wraps continuously (0° = 360°)

## Why Double Cone Shape?

The bicone structure reflects fundamental color properties:

1. **Pure Colors at Middle**: Maximum saturation only possible at 50% lightness
2. **Convergence at Extremes**: All colors become black or white at 0%/100% lightness
3. **Saturation Limits**: Available saturation decreases as lightness approaches extremes
4. **Perceptual Alignment**: Matches human understanding of color brightness and intensity

## HSL vs RGB Comparison

| Aspect | HSL | RGB |
|--------|-----|-----|
| **Structure** | Cylindrical (double cone) | Cubic |
| **Components** | Hue, Saturation, Lightness | Red, Green, Blue |
| **Intuition** | Matches human perception | Matches display technology |
| **Color Picking** | Natural color selection | Technical color mixing |
| **Distance Calculation** | Meaningful perceptual distance | Mathematical but less intuitive |

### Why HSL for On the Spectrum?

1. **Intuitive Descriptions**: Players can naturally describe colors using concepts like:
   - "Bright red" (H=0°, S=100%, L=75%)
   - "Pale blue" (H=240°, S=50%, L=80%)
   - "Dark green" (H=120°, S=80%, L=30%)

2. **Full Spectrum Access**: Complete 360° hue range provides access to all visible colors

3. **Precise Control**: 1-degree hue precision and 1% saturation/lightness precision

4. **Scoring Algorithm**: Euclidean distance in HSL space provides meaningful color similarity measurements

## Scoring Systems

On the Spectrum uses **two different scoring algorithms** depending on the game mode:

### 1. Multiplayer Scoring - Geometric Normal Distribution

**Location**: `service/lambda/websocket/scoring.ts`

Used for real-time multiplayer games where players guess a fixed target color.

#### Configuration
```typescript
const NORMAL_CONFIG = {
    sigma: {
        hue: 25,        // degrees (3-sigma = 75 degrees)
        saturation: 25, // percent (3-sigma = 75 percent)
        lightness: 15   // percent (3-sigma = 45 percent)
    },
    weights: {
        hue: 6.0,       // Most important - color identity
        saturation: 1.0, // Baseline weight
        lightness: 2.0   // Moderate importance
    }
};
```

#### How It Works

**Step 1: Calculate Component Differences**
```typescript
// Hue wraps around (0° = 360°)
const hueDiff = Math.min(
    Math.abs(targetColor.h - guessedColor.h),
    360 - Math.abs(targetColor.h - guessedColor.h)
);

const satDiff = Math.abs(targetColor.s - guessedColor.s);
const lightDiff = Math.abs(targetColor.l - guessedColor.l);
```

**Step 2: Dynamic Sigma Adjustments**

The algorithm adjusts tolerance based on the target color's properties:

- **Hue Tolerance**: Increases for extreme lightness values
  - At L=10% or L=90%: Hue matters less (colors look similar)
  - At L=50%: Standard hue tolerance (25°)
  
- **Lightness Tolerance**: Scales proportionally to target lightness
  - Darker colors (L=25%) have tighter tolerance
  - Mid-range colors (L=50%) have standard tolerance

**Step 3: 3-Sigma Cutoff**

Any guess beyond 3 standard deviations from the target in ANY component scores 0 points:
```typescript
if (hueDiff > 3 * adjustedHueSigma || 
    satDiff > 3 * NORMAL_CONFIG.sigma.saturation || 
    lightDiff > 3 * adjustedLightnessSigma) {
    return 0;
}
```

**Step 4: Normal Distribution Components**

Each component gets a score from 0-1 using the Gaussian formula:
```typescript
const hueComponent = Math.exp(-0.5 * Math.pow(hueDiff / adjustedHueSigma, 2));
const satComponent = Math.exp(-0.5 * Math.pow(satDiff / NORMAL_CONFIG.sigma.saturation, 2));
const lightComponent = Math.exp(-0.5 * Math.pow(lightDiff / adjustedLightnessSigma, 2));
```

**Step 5: Weighted Geometric Mean**

Combines the three components using their weights:
```typescript
const totalWeight = 6.0 + 1.0 + 2.0; // = 9.0
const score = Math.round(100 * Math.pow(
    Math.pow(hueComponent, 6.0) *
    Math.pow(satComponent, 1.0) *
    Math.pow(lightComponent, 2.0),
    1 / totalWeight
));
```

#### Why Geometric Mean?

Unlike arithmetic mean, geometric mean **prevents compensation** between components:
- You can't offset a terrible hue guess with perfect saturation
- All components must be reasonably close to score well
- More accurately reflects human color perception

#### Scoring Examples

**Perfect Match**:
- Target: H=180°, S=80%, L=50%
- Guess: H=180°, S=80%, L=50%
- Score: **100 points**

**Close Match**:
- Target: H=180°, S=80%, L=50%
- Guess: H=185°, S=75%, L=52%
- Score: **~95 points**

**Good Match**:
- Target: H=180°, S=80%, L=50%
- Guess: H=200°, S=70%, L=55%
- Score: **~75 points**

**Poor Match**:
- Target: H=180°, S=80%, L=50%
- Guess: H=0°, S=50%, L=30%
- Score: **0 points** (hue beyond 3-sigma)

---

### 2. Daily Challenge Scoring - Bicone Distance

**Location**: `service/lambda/rest/scoring.ts`

Used for daily challenges where players are scored based on distance from the community average.

#### Bicone Cartesian Space

Converts HSL to 3D Cartesian coordinates in bicone geometry:

```typescript
function hslToBiconeCartesian(color: HSLColor) {
    const { h, s, l } = color;
    
    // Bicone radius varies with lightness
    const radius = (s / 100) * Math.min(l, 100 - l) / 50;
    
    // Convert hue to radians
    const hueRad = (h * Math.PI) / 180;
    
    // Cartesian coordinates
    const x = radius * Math.cos(hueRad);
    const y = radius * Math.sin(hueRad);
    const z = (l - 50) / 50; // Normalize lightness to [-1, 1]
    
    return { x, y, z };
}
```

#### Why Bicone Space?

The bicone (double cone) geometry accurately represents HSL color space:
- **Radius varies with lightness**: Maximum saturation only possible at L=50%
- **Converges at extremes**: All colors become black (L=0%) or white (L=100%)
- **Euclidean distance**: Meaningful in 3D Cartesian space

#### Average Calculation

Uses **Welford's algorithm** for efficient incremental updates:

```typescript
function updateAverageColor(
    previousAverage: HSLColor,
    previousCount: number,
    newColor: HSLColor
): { averageColor: HSLColor, stats: ComponentStats }
```

**Process**:
1. Convert previous average and new color to bicone Cartesian
2. Calculate new average: `(old_avg × n + new_value) / (n + 1)`
3. Update variance statistics using Welford's algorithm
4. Convert result back to HSL

#### Distance Scoring

```typescript
function distanceFromAverageScoring(
    submittedColor: HSLColor,
    averageColor: HSLColor
): { score: number, distance: number } {
    // Convert to bicone Cartesian
    const submittedCart = hslToBiconeCartesian(submittedColor);
    const averageCart = hslToBiconeCartesian(averageColor);
    
    // Euclidean distance in 3D space
    const distance = Math.sqrt(
        (submittedCart.x - averageCart.x) ** 2 +
        (submittedCart.y - averageCart.y) ** 2 +
        (submittedCart.z - averageCart.z) ** 2
    );
    
    // Normalize and invert (closer = higher score)
    const maxDistance = Math.sqrt(2); // Corner to corner
    const normalizedDistance = Math.min(distance / maxDistance, 1.0);
    const score = Math.round(100 * (1 - normalizedDistance));
    
    return { score, distance };
}
```

#### Scoring Examples

**Perfect Match** (same as average):
- Average: H=180°, S=80%, L=50%
- Submission: H=180°, S=80%, L=50%
- Distance: 0.0
- Score: **100 points**

**Close to Average**:
- Average: H=180°, S=80%, L=50%
- Submission: H=185°, S=75%, L=52%
- Distance: ~0.05
- Score: **~96 points**

**Far from Average**:
- Average: H=180°, S=80%, L=50%
- Submission: H=0°, S=20%, L=80%
- Distance: ~1.2
- Score: **~15 points**

---

### Comparison

| Aspect | Multiplayer | Daily Challenge |
|--------|-------------|-----------------|
| **Target** | Fixed generated color | Community average color |
| **Algorithm** | Geometric normal distribution | Bicone Euclidean distance |
| **Space** | HSL components | Bicone Cartesian (3D) |
| **Weights** | Component-weighted (H:6, S:1, L:2) | Equal 3D distance |
| **Cutoff** | 3-sigma threshold (0 points) | Linear scaling (0-100) |
| **Updates** | Static target per round | Average recalculates with each submission |
| **Use Case** | Guess accuracy vs fixed target | Consensus finding |
| **Describer Bonus** | Gets average of all guesser scores | N/A (single player) |

### Why Different Algorithms?

**Multiplayer** needs to reward accuracy against a specific target:
- Weighted components reflect human color perception
- 3-sigma cutoff prevents random guessing
- Geometric mean prevents compensation

**Daily Challenge** needs to measure consensus:
- Euclidean distance in bicone space is geometrically accurate
- Linear scaling rewards getting closer to community
- No cutoff - all submissions contribute to average

### Special Scoring Cases

**Multiplayer Only**:
- **No Clue Provided**: If describer times out without providing a description, all guessers receive +100 points and the describer gets 0 points
- **Timeout with Draft**: If a player doesn't submit but has a draft color, the draft is automatically submitted and scored normally
