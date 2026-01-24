export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert client HSL color format (integers: H: 0-360, S/L: 0-100) to server format
 */
export const convertToServerColor = (color: HSLColor): HSLColor => ({
  h: Math.round(color.h),
  s: Math.round(color.s),
  l: Math.round(color.l)
});

/**
 * Convert server HSL color format to client format (integers: H: 0-360, S/L: 0-100)
 */
export const convertToClientColor = (color: HSLColor): HSLColor => ({
  h: Math.round(color.h),
  s: Math.round(color.s),
  l: Math.round(color.l)
});

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;
  
  let r: number, g: number, b: number;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
};

export const calculateSaturationFromAngle = (angle: number): number => {
  return Math.pow((-Math.sin(angle * Math.PI / 180) + 1) / 2, 0.2) * 100;
};

export const calculateAngleFromSaturation = (s: number): number => {
  return Math.asin(-Math.pow(s / 100, 1/0.2) * 2 + 1) * 180 / Math.PI;
};

export const calculateLightnessFromDistance = (normalizedDistance: number): number => {
  // Map distance to lightness with 15-85% taking 98% of radius
  // Center (0% distance): 100% lightness
  // Edge (100% distance): 0% lightness
  // 85-100%: first 1% of radius (center to 1%)
  // 15-85%: middle 98% of radius (1% to 99%) with 3/4 exponent curve
  // 0-15%: last 1% of radius (99% to 100%)
  
  if (normalizedDistance <= 0.01) {
    // First 1% of radius: 85-100% lightness
    return 100 - (normalizedDistance / 0.01) * 15;
  } else if (normalizedDistance >= 0.99) {
    // Last 1% of radius: 0-15% lightness  
    return 15 - ((normalizedDistance - 0.99) / 0.01) * 15;
  } else {
    // Middle 98% of radius: 15-85% lightness with 3/4 exponent curve
    // 3/4 exponent emphasizes values closer to center (higher lightness)
    const normalizedMiddle = (normalizedDistance - 0.01) / 0.98;
    const curvedValue = Math.pow(1 - normalizedMiddle, 3/4);
    return 15 + curvedValue * 70;
  }
};

export const calculateDistanceFromLightness = (l: number): number => {
  // Inverse mapping
  if (l >= 85) {
    // 85-100% lightness: first 1% of radius (center)
    return ((100 - l) / 15) * 0.01;
  } else if (l <= 15) {
    // 0-15% lightness: last 1% of radius (edge)
    return 0.99 + ((15 - l) / 15) * 0.01;
  } else {
    // 15-85% lightness: middle 98% of radius with inverse 3/4 exponent
    const normalizedL = (l - 15) / 70;
    const curvedValue = 1 - Math.pow(normalizedL, 4/3);
    return 0.01 + curvedValue * 0.98;
  }
};

export const cartesianToPolar = (x: number, y: number, center: number) => {
  const dx = x - center;
  const dy = y - center;
  const distance = Math.sqrt(dx * dx + dy * dy);
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return { distance, angle };
};

export const setBodyBackground = (color: HSLColor) => {
  document.body.style.backgroundColor = `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
};
