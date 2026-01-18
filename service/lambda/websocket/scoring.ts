interface HSLColor {
    h: number; // 0-360 degrees
    s: number; // 0-100 percent
    l: number; // 0-100 percent
}

export type ScoringAlgorithm = (targetColor: HSLColor, guessedColor: HSLColor) => number;

// Configuration for threshold-based scoring
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

// Threshold-based scoring with geometrically accurate bicone weighting
export function geometricThresholdScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
    // Normalize hue difference (0-360 wraps around) - handle negative properly
    const hueDiff = Math.min(
        Math.abs(targetColor.h - guessedColor.h),
        360 - Math.abs(targetColor.h - guessedColor.h)
    );
    
    const satDiff = Math.abs(targetColor.s - guessedColor.s);
    const lightDiff = Math.abs(targetColor.l - guessedColor.l);
    
    // Apply thresholds with linear ramp
    const hueComponent = hueDiff > THRESHOLD_CONFIG.thresholds.hue ? 0 : 
                        hueDiff <= THRESHOLD_CONFIG.tolerances.hue ? 1.0 : 
                        (THRESHOLD_CONFIG.thresholds.hue - hueDiff) / (THRESHOLD_CONFIG.thresholds.hue - THRESHOLD_CONFIG.tolerances.hue);
    
    const satComponent = satDiff > THRESHOLD_CONFIG.thresholds.saturation ? 0 : 
                        satDiff <= THRESHOLD_CONFIG.tolerances.saturation ? 1.0 : 
                        (THRESHOLD_CONFIG.thresholds.saturation - satDiff) / (THRESHOLD_CONFIG.thresholds.saturation - THRESHOLD_CONFIG.tolerances.saturation);
    
    const lightComponent = lightDiff > THRESHOLD_CONFIG.thresholds.lightness ? 0 : 
                          lightDiff <= THRESHOLD_CONFIG.tolerances.lightness ? 1.0 : 
                          (THRESHOLD_CONFIG.thresholds.lightness - lightDiff) / (THRESHOLD_CONFIG.thresholds.lightness - THRESHOLD_CONFIG.tolerances.lightness);
    
    // Calculate composite score using geometric mean with weights as exponents
    const score = Math.round(100 * Math.pow(
        Math.pow(hueComponent, THRESHOLD_CONFIG.weights.hue) *
        Math.pow(satComponent, THRESHOLD_CONFIG.weights.saturation) *
        Math.pow(lightComponent, THRESHOLD_CONFIG.weights.lightness),
        1 / (THRESHOLD_CONFIG.weights.hue + THRESHOLD_CONFIG.weights.saturation + THRESHOLD_CONFIG.weights.lightness)
    ));
    
    return Math.max(0, score);
}

// Convert HSL color to Cartesian coordinates in bicone space
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

// True Euclidean distance in HSL bicone space
export function biconeEuclideanScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
    // Convert both colors to bicone coordinates
    const targetCart = hslToBiconeCartesian(targetColor);
    const guessCart = hslToBiconeCartesian(guessedColor);
    
    // Calculate Euclidean distance
    const distance = Math.sqrt(
        (targetCart.x - guessCart.x) ** 2 +
        (targetCart.y - guessCart.y) ** 2 +
        (targetCart.z - guessCart.z) ** 2
    );
    
    // Convert distance to score (0-100)
    const maxDistance = 0.5;
    const normalizedDistance = Math.min(distance / (maxDistance), 1.0);
    
    // Linear falloff from 100 to 0
    const score = Math.round(100 * (1 - normalizedDistance));
    
    return Math.max(0, score);
}
