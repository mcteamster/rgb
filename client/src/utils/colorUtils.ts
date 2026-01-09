export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert client HSL color format (0-1) to server format (0-100 for S/L)
 */
export const convertToServerColor = (color: HSLColor): HSLColor => ({
  h: color.h,
  s: Math.round(color.s * 100),
  l: Math.round(color.l * 100)
});

/**
 * Convert server HSL color format (0-100 for S/L) to client format (0-1)
 */
export const convertToClientColor = (color: HSLColor): HSLColor => ({
  h: color.h,
  s: color.s / 100,
  l: color.l / 100
});

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
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
  return Math.pow((-Math.sin(angle * Math.PI / 180) + 1) / 2, 0.3);
};

export const calculateAngleFromSaturation = (s: number): number => {
  return Math.asin(-Math.pow(s, 1/0.3) * 2 + 1) * 180 / Math.PI;
};

export const calculateLightnessFromDistance = (normalizedDistance: number): number => {
  return Math.pow(1 - normalizedDistance, 2/3);
};

export const calculateDistanceFromLightness = (l: number): number => {
  return 1 - Math.pow(l, 3/2);
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
  document.body.style.backgroundColor = `hsl(${color.h}, ${color.s * 100}%, ${color.l * 100}%)`;
};
