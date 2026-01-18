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
- **Lightness Range**: 15-95% (avoid pure black/white)
- **Precision**: 1° hue, 1% saturation/lightness

### Current Algorithm: Geometric Threshold Scoring

On the Spectrum uses threshold-based scoring with geometric mean combination for balanced accuracy requirements:

```typescript
const THRESHOLD_CONFIG = {
    thresholds: {
        hue: 90,        // degrees
        saturation: 50, // percent
        lightness: 25   // percent
    },
    tolerances: {
        hue: 5,         // degrees - full marks within this range
        saturation: 2,  // percent - full marks within this range
        lightness: 1    // percent - full marks within this range
    },
    weights: {
        hue: 7.0,
        saturation: 1.0,
        lightness: 2.0
    }
};

function geometricThresholdScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
  let hueDiff = Math.abs(targetColor.h - guessedColor.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;
  
  const satDiff = Math.abs(targetColor.s - guessedColor.s);
  const lightDiff = Math.abs(targetColor.l - guessedColor.l);
  
  // Apply thresholds with linear ramp
  const hueComponent = hueDiff > 90 ? 0 : 
                      hueDiff <= 5 ? 1.0 : 
                      (90 - hueDiff) / (90 - 5);
  
  const satComponent = satDiff > 50 ? 0 : 
                      satDiff <= 2 ? 1.0 : 
                      (50 - satDiff) / (50 - 2);
  
  const lightComponent = lightDiff > 25 ? 0 : 
                        lightDiff <= 1 ? 1.0 : 
                        (25 - lightDiff) / (25 - 1);
  
  // Geometric mean with weights as exponents (7:1:2 ratio)
  return Math.round(100 * Math.pow(
    Math.pow(hueComponent, 7.0) * 
    Math.pow(satComponent, 1.0) * 
    Math.pow(lightComponent, 2.0),
    1 / (7.0 + 1.0 + 2.0)
  ));
}
```

#### Scoring Zones
- **Tolerance Zone**: Perfect score (1.0) within small differences
  - Hue: ±5° | Saturation: ±2% | Lightness: ±1%
- **Linear Penalty Zone**: Gradual score reduction
  - Hue: 5-90° | Saturation: 2-50% | Lightness: 1-25%
- **Failure Zone**: Zero score beyond thresholds
  - Hue: >90° | Saturation: >50% | Lightness: >25%

#### Characteristics
- **Weighted importance**: Hue most critical (7x), lightness moderate (2x), saturation baseline (1x)
- **Forgiving thresholds**: Accounts for subjective nature of color communication
- **No compensation**: Cannot make up for poor performance in one area with excellence in another
- **Exponential weighting**: Components raised to power of their weights in geometric mean

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
