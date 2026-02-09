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

On the Spectrum uses **two separate scoring systems** for different game modes:

### 1. Multiplayer Scoring (Geometric Normal Distribution)

**Location**: `service/lambda/websocket/scoring.ts`

Used for real-time multiplayer games where players guess a target color based on a description.

#### Configuration
```typescript
const NORMAL_CONFIG = {
    sigma: {
        hue: 25,        // degrees (3-sigma = 75 degrees)
        saturation: 25, // percent (3-sigma = 75 percent)
        lightness: 15   // percent (3-sigma = 45 percent)
    },
    weights: {
        hue: 6.0,
        saturation: 1.0,
        lightness: 2.0
    }
};
```

#### Algorithm: `geometricNormalScoring()`

Normal distribution curves for each HSL component, combined with weighted geometric mean:

```typescript
function geometricNormalScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
    // Normalize hue difference (0-360 wraps around)
    const hueDiff = Math.min(
        Math.abs(targetColor.h - guessedColor.h),
        360 - Math.abs(targetColor.h - guessedColor.h)
    );
    
    const satDiff = Math.abs(targetColor.s - guessedColor.s);
    const lightDiff = Math.abs(targetColor.l - guessedColor.l);
    
    // Adjust hue sigma based on target lightness extremity
    let multiplier = 1;
    if (targetColor.l < 20) multiplier = 1 + 2 * (20 - targetColor.l) / 5;
    else if (targetColor.l > 80) multiplier = 1 + 2 * (targetColor.l - 80) / 5;
    const adjustedHueSigma = NORMAL_CONFIG.sigma.hue * multiplier;
    
    // Adjust lightness sigma proportionally to target lightness
    const adjustedLightnessSigma = NORMAL_CONFIG.sigma.lightness * (targetColor.l / 50);
    
    // Check 3-sigma thresholds (anything beyond is 0)
    if (hueDiff > 3 * adjustedHueSigma || 
        satDiff > 3 * NORMAL_CONFIG.sigma.saturation || 
        lightDiff > 3 * adjustedLightnessSigma) {
        return 0;
    }
    
    // Calculate normal distribution components
    const hueComponent = Math.exp(-0.5 * Math.pow(hueDiff / adjustedHueSigma, 2));
    const satComponent = Math.exp(-0.5 * Math.pow(satDiff / NORMAL_CONFIG.sigma.saturation, 2));
    const lightComponent = Math.exp(-0.5 * Math.pow(lightDiff / adjustedLightnessSigma, 2));
    
    // Weighted geometric mean
    const score = Math.round(100 * Math.pow(
        Math.pow(hueComponent, NORMAL_CONFIG.weights.hue) *
        Math.pow(satComponent, NORMAL_CONFIG.weights.saturation) *
        Math.pow(lightComponent, NORMAL_CONFIG.weights.lightness),
        1 / (NORMAL_CONFIG.weights.hue + NORMAL_CONFIG.weights.saturation + NORMAL_CONFIG.weights.lightness)
    ));
    
    return Math.max(0, score);
}
```

#### Characteristics

**Normal Distribution Curves**:
- Each HSL component uses Gaussian curve centered on target value
- Standard deviations (sigma) define tolerance levels
- 3-sigma cutoff: completely wrong colors get 0 points

**Dynamic Hue Tolerance**:
- **L=20-80%**: Standard hue sigma (25°)
- **L<20% or L>80%**: Increased tolerance (up to 3x) for extreme lightness
- Reflects reduced hue perception at very dark/light colors

**Dynamic Lightness Tolerance**:
- Sigma scales proportionally with target lightness
- Darker colors (L=25%) have tighter tolerance than mid-range (L=50%)

**Component Weights**:
- **Hue**: 6.0 (most important - color identity)
- **Saturation**: 1.0 (baseline)
- **Lightness**: 2.0 (moderate importance)

**Geometric Mean**: Prevents compensation between components (can't offset bad hue with perfect saturation)

### 2. Daily Challenge Scoring (Bicone Distance)

**Location**: `service/lambda/rest/scoring.ts`

Used for daily challenges where players submit colors without a target, and are scored based on distance from the community average.

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

#### Incremental Average Calculation

Uses **Welford's algorithm** for O(1) average updates:

```typescript
function updateAverageColor(
    currentAverage: HSLColor | null,
    currentStats: ComponentStats | null,
    newColor: HSLColor,
    totalSubmissions: number
): { averageColor: HSLColor, stats: ComponentStats }
```

Stores running mean and M2 (sum of squared differences) for each component:
```typescript
interface ComponentStats {
    h: { mean: number, m2: number },
    s: { mean: number, m2: number },
    l: { mean: number, m2: number }
}
```

#### Scoring Rules

1. **First 2 submissions**: Automatic 100 points
2. **3rd+ submissions**: Scored by Euclidean distance from average in bicone space
3. **Distance formula**: `sqrt((x1-x2)² + (y1-y2)² + (z1-z2)²)`
4. **Score**: `100 × (1 - distance/maxDistance)` where maxDistance ≈ √2

### Comparison

| Aspect | Multiplayer | Daily Challenge |
|--------|-------------|-----------------|
| **Target** | Fixed color | Community average |
| **Space** | HSL components | Bicone Cartesian |
| **Algorithm** | Normal distribution | Euclidean distance |
| **Weights** | Component-weighted | Equal 3D distance |
| **Updates** | Static target | Incremental average |
| **Use Case** | Guess accuracy | Consensus finding |
