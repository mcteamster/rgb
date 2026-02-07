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

// Convert HSL color to Cartesian coordinates in bicone space
export function hslToBiconeCartesian(color: HSLColor) {
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

/**
 * Inverse transformation: Bicone Cartesian → HSL
 */
export function biconeCartesianToHSL(cart: { x: number, y: number, z: number }): HSLColor {
    // Lightness from z-coordinate (map [-1, 1] to [0, 100])
    const l = (cart.z * 50) + 50;

    // Hue from angle in xy-plane (map atan2 result to [0, 360])
    const h = (Math.atan2(cart.y, cart.x) * 180 / Math.PI + 360) % 360;

    // Saturation from radius
    const radius = Math.sqrt(cart.x ** 2 + cart.y ** 2);
    const s = (radius * 50) / Math.min(l, 100 - l) * 100;

    return {
        h,
        s: Math.min(100, Math.max(0, s)), // Clamp to [0, 100]
        l
    };
}

/**
 * Calculate average color in bicone space
 */
export function calculateAverageColor(colors: HSLColor[]): HSLColor {
    if (colors.length === 0) {
        return { h: 0, s: 0, l: 50 }; // Gray fallback
    }

    if (colors.length === 1) {
        return colors[0]; // Single color = average
    }

    // Convert all colors to bicone Cartesian coordinates
    const cartesianPoints = colors.map(hslToBiconeCartesian);

    // Calculate centroid (average) in 3D space
    const avgX = cartesianPoints.reduce((sum, p) => sum + p.x, 0) / colors.length;
    const avgY = cartesianPoints.reduce((sum, p) => sum + p.y, 0) / colors.length;
    const avgZ = cartesianPoints.reduce((sum, p) => sum + p.z, 0) / colors.length;

    // Convert centroid back to HSL
    return biconeCartesianToHSL({ x: avgX, y: avgY, z: avgZ });
}

/**
 * Score based on distance from average (for daily challenge)
 * Closer to average = higher score
 */
export function distanceFromAverageScoring(
    submittedColor: HSLColor,
    averageColor: HSLColor
): { score: number, distance: number } {
    // Use bicone Euclidean distance (same as biconeEuclideanScoring)
    const submittedCart = hslToBiconeCartesian(submittedColor);
    const averageCart = hslToBiconeCartesian(averageColor);

    const distance = Math.sqrt(
        (submittedCart.x - averageCart.x) ** 2 +
        (submittedCart.y - averageCart.y) ** 2 +
        (submittedCart.z - averageCart.z) ** 2
    );

    // Invert distance to score (closer = higher)
    // Max distance in bicone space ≈ √2 (corner to corner)
    const maxDistance = Math.sqrt(2);
    const normalizedDistance = Math.min(distance / maxDistance, 1.0);
    const score = Math.round(100 * (1 - normalizedDistance));

    return { score, distance };
}
