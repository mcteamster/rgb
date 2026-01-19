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

## Scoring System
### Game Constraints

- **Hue Range**: 0-360° (full spectrum)
- **Saturation Range**: 10-100% (avoid pure grayscale)
- **Lightness Range**: 15-85% (avoid pure black/white)
- **Precision**: 1° hue, 1% saturation/lightness

### Current Algorithm: Geometric Normal Distribution Scoring

On the Spectrum uses normal distribution curves for each HSL component, combined with a weighted geometric mean for balanced scoring:

```typescript
const NORMAL_CONFIG = {
    sigma: {
        hue: 25,        // degrees (3-sigma = 75 degrees)
        saturation: 35, // percent (3-sigma = 105 percent)
        lightness: 15   // percent (3-sigma = 45 percent)
    },
    weights: {
        hue: 6.0,
        saturation: 1.0,
        lightness: 2.0
    }
};

function geometricNormalScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
    // Normalize hue difference (0-360 wraps around)
    const hueDiff = Math.min(
        Math.abs(targetColor.h - guessedColor.h),
        360 - Math.abs(targetColor.h - guessedColor.h)
    );
    
    const satDiff = Math.abs(targetColor.s - guessedColor.s);
    const lightDiff = Math.abs(targetColor.l - guessedColor.l);
    
    // Adjust hue sigma based on target lightness extremity (playable range: 15-85%)
    let multiplier = 1;
    if (targetColor.l < 20) multiplier = 1 + 2 * (20 - targetColor.l) / 5;
    else if (targetColor.l > 80) multiplier = 1 + 2 * (targetColor.l - 80) / 5;
    const adjustedHueSigma = NORMAL_CONFIG.sigma.hue * multiplier;
    
    // Check 3-sigma thresholds (anything beyond is 0)
    if (hueDiff > 3 * adjustedHueSigma || 
        satDiff > 3 * NORMAL_CONFIG.sigma.saturation || 
        lightDiff > 3 * NORMAL_CONFIG.sigma.lightness) {
        return 0;
    }
    
    // Calculate normal distribution components
    const hueComponent = Math.exp(-0.5 * Math.pow(hueDiff / adjustedHueSigma, 2));
    const satComponent = Math.exp(-0.5 * Math.pow(satDiff / NORMAL_CONFIG.sigma.saturation, 2));
    const lightComponent = Math.exp(-0.5 * Math.pow(lightDiff / NORMAL_CONFIG.sigma.lightness, 2));
    
    // Calculate composite score using geometric mean with weights as exponents
    const score = Math.round(100 * Math.pow(
        Math.pow(hueComponent, NORMAL_CONFIG.weights.hue) *
        Math.pow(satComponent, NORMAL_CONFIG.weights.saturation) *
        Math.pow(lightComponent, NORMAL_CONFIG.weights.lightness),
        1 / (NORMAL_CONFIG.weights.hue + NORMAL_CONFIG.weights.saturation + NORMAL_CONFIG.weights.lightness)
    ));
    
    return Math.max(0, score);
}
```

#### Scoring Characteristics

**Normal Distribution Curves**:
- Each HSL component uses a Gaussian curve centered on the target value
- Standard deviations (sigma) define tolerance levels
- 3-sigma cutoff ensures completely wrong colors get 0 points

**Dynamic Hue Tolerance**:
- **L=20-80%**: Standard hue sigma (25°)
- **L=15-20%**: Linear ramp from 3x to 1x multiplier (75° to 25°)
- **L=80-85%**: Linear ramp from 1x to 3x multiplier (25° to 75°)
- Reflects reduced hue perception at extreme lightness values

**Component Weights**:
- **Hue**: 6.0 (most important - color identity)
- **Saturation**: 1.0 (baseline importance)
- **Lightness**: 2.0 (moderate importance - brightness)

**Geometric Mean Combination**:
- Prevents compensation between components
- Weighted by raising each component to its weight power
- Normalized by total weight sum for 0-100 scale

#### Scoring Zones

**Perfect Match**: Score approaches 100 for identical colors
**Gradual Falloff**: Smooth score reduction following normal curves
**Hard Cutoffs**: Zero score beyond 3-sigma thresholds:
- Hue: >75° (or >225° at extremes)
- Saturation: >75%
- Lightness: >45%

### Alternative Scoring Options

#### Bicone Euclidean Scoring
```typescript
function biconeEuclideanScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
  // Convert to bicone coordinates and calculate Euclidean distance
  // Uses true 3D geometry for mathematically accurate scoring
}
```
- **Characteristics**: Geometrically accurate, smooth distance-based scoring
- **Use case**: When mathematical precision is preferred over interpretable thresholds
