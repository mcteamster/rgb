export interface HSLColor {
    h: number; // 0-360 degrees
    s: number; // 0-100 percent
    l: number; // 0-100 percent
}

export interface DailyChallenge {
    challengeId: string;
    prompt: string;
    validFrom: string;
    validUntil: string;
    totalSubmissions: number;
}

export interface Submission {
    color: HSLColor;
    score: number;
    submittedAt: string;
    rank?: number;
    distanceFromAverage?: number;
    averageColor?: HSLColor;
}

export interface LeaderboardEntry {
    rank: number;
    userName: string;
    score: number;
    submittedColor: HSLColor;
    userId?: string;
}

export interface CurrentChallengeResponse {
    challengeId: string;
    prompt: string;
    validFrom: string;
    validUntil: string;
    totalSubmissions: number;
    userSubmission: Submission | null;
}

export interface SubmissionRequest {
    challengeId: string;
    userId: string;
    userName: string;
    color: HSLColor;
    fingerprint: string;
}

export interface SubmissionResponse {
    success: boolean;
    submission: {
        challengeId: string;
        score: number;
        rank: number;
        distanceFromAverage: number;
        averageColor: HSLColor;
        submittedAt: string;
    };
}

export interface LeaderboardResponse {
    challengeId: string;
    prompt: string;
    status: string;
    totalSubmissions: number;
    topScores: LeaderboardEntry[];
    yourSubmission: {
        rank: number;
        score: number;
        submittedColor: HSLColor;
        distanceFromAverage: number;
    } | null;
}

export interface HistorySubmission {
    challengeId: string;
    prompt: string;
    submittedColor: HSLColor;
    averageAtSubmission: HSLColor;
    score: number;
    rank: number;
    totalSubmissions: number;
}

export interface HistoryResponse {
    userId: string;
    submissions: HistorySubmission[];
    stats: {
        totalPlayed: number;
        averageScore: number;
        bestScore: number;
        currentStreak: number;
    };
}
