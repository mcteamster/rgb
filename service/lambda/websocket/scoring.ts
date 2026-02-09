export interface HSLColor {
    h: number; // 0-360 degrees
    s: number; // 0-100 percent
    l: number; // 0-100 percent
}

export type ScoringAlgorithm = (targetColor: HSLColor, guessedColor: HSLColor) => number;

// Configuration for normal distribution scoring
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

// Normal distribution scoring with 3-sigma thresholds
export function geometricNormalScoring(targetColor: HSLColor, guessedColor: HSLColor): number {
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
    
    // Calculate composite score using geometric mean with weights as exponents
    const score = Math.round(100 * Math.pow(
        Math.pow(hueComponent, NORMAL_CONFIG.weights.hue) *
        Math.pow(satComponent, NORMAL_CONFIG.weights.saturation) *
        Math.pow(lightComponent, NORMAL_CONFIG.weights.lightness),
        1 / (NORMAL_CONFIG.weights.hue + NORMAL_CONFIG.weights.saturation + NORMAL_CONFIG.weights.lightness)
    ));
    
    return Math.max(0, score);
}
