export interface HSLColor {
    h: number; // 0-360 degrees
    s: number; // 0-100 percent
    l: number; // 0-100 percent
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

export interface ComponentStats {
    mean: number;
    m2: number; // Sum of squared differences from mean (for variance calculation)
}

/**
 * Incrementally update average color and variance using Welford's algorithm
 * More efficient than recalculating from all colors
 */
export function updateAverageColor(
    previousAverage: HSLColor,
    previousCount: number,
    newColor: HSLColor,
    previousStats?: { h: ComponentStats; s: ComponentStats; l: ComponentStats }
): { 
    averageColor: HSLColor;
    stats: { h: ComponentStats; s: ComponentStats; l: ComponentStats };
} {
    if (previousCount === 0) {
        return {
            averageColor: newColor,
            stats: {
                h: { mean: newColor.h, m2: 0 },
                s: { mean: newColor.s, m2: 0 },
                l: { mean: newColor.l, m2: 0 }
            }
        };
    }

    // Convert to Cartesian coordinates for average
    const prevCart = hslToBiconeCartesian(previousAverage);
    const newCart = hslToBiconeCartesian(newColor);

    // Incremental average: new_avg = (old_avg * n + new_value) / (n + 1)
    const newCount = previousCount + 1;
    const avgX = (prevCart.x * previousCount + newCart.x) / newCount;
    const avgY = (prevCart.y * previousCount + newCart.y) / newCount;
    const avgZ = (prevCart.z * previousCount + newCart.z) / newCount;

    // Welford's algorithm for variance (per component)
    const updateComponentStats = (prev: ComponentStats, newValue: number): ComponentStats => {
        const delta = newValue - prev.mean;
        const newMean = prev.mean + delta / newCount;
        const delta2 = newValue - newMean;
        const newM2 = prev.m2 + delta * delta2;
        return { mean: newMean, m2: newM2 };
    };

    const stats = {
        h: updateComponentStats(previousStats?.h || { mean: previousAverage.h, m2: 0 }, newColor.h),
        s: updateComponentStats(previousStats?.s || { mean: previousAverage.s, m2: 0 }, newColor.s),
        l: updateComponentStats(previousStats?.l || { mean: previousAverage.l, m2: 0 }, newColor.l)
    };

    // Convert back to HSL
    return {
        averageColor: biconeCartesianToHSL({ x: avgX, y: avgY, z: avgZ }),
        stats
    };
}

/**
 * Score based on distance from average (for daily challenge)
 * Closer to average = higher score
 */
export function distanceFromAverageScoring(
    submittedColor: HSLColor,
    averageColor: HSLColor
): { score: number, distance: number } {
    // Use bicone Euclidean distance
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
