import { useEffect, useRef } from 'react';

export const useLeaderboardLoader = (
  showLeaderboard: boolean,
  challengeId: string | undefined,
  loadLeaderboard: (id: string) => void
) => {
  const loadedChallengeId = useRef<string | null>(null);

  useEffect(() => {
    if (showLeaderboard && challengeId && loadedChallengeId.current !== challengeId) {
      loadedChallengeId.current = challengeId;
      loadLeaderboard(challengeId);
    }
  }, [showLeaderboard, challengeId, loadLeaderboard]);
};
