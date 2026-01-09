/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
export const getOrdinalSuffix = (rank: number): string => {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
};

/**
 * Format time remaining in seconds to display format
 */
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};
