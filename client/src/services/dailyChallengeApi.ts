import {
    CurrentChallengeResponse,
    SubmissionRequest,
    SubmissionResponse,
    LeaderboardResponse,
    HistoryResponse
} from '../types/dailyChallenge';

export class DailyChallengeAPI {
    private baseUrl: string;

    constructor() {
        // Use environment variable for API base URL
        this.baseUrl = import.meta.env.VITE_DAILY_CHALLENGE_API_URL || '';
    }

    async getCurrentChallenge(userId: string): Promise<CurrentChallengeResponse> {
        const response = await fetch(`${this.baseUrl}/daily-challenge/current?userId=${userId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch current challenge: ${response.statusText}`);
        }
        return response.json();
    }

    async submitChallenge(submission: SubmissionRequest): Promise<SubmissionResponse> {
        const response = await fetch(`${this.baseUrl}/daily-challenge/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to submit challenge: ${response.statusText}`);
        }
        return response.json();
    }

    async getLeaderboard(challengeId: string, userId: string): Promise<LeaderboardResponse> {
        const response = await fetch(
            `${this.baseUrl}/daily-challenge/leaderboard/${challengeId}?userId=${userId}`
        );
        if (!response.ok) {
            throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }
        return response.json();
    }

    async getUserHistory(userId: string, limit: number = 30): Promise<HistoryResponse> {
        const response = await fetch(`${this.baseUrl}/daily-challenge/history/${userId}?limit=${limit}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user history: ${response.statusText}`);
        }
        return response.json();
    }
}

export const dailyChallengeApi = new DailyChallengeAPI();
