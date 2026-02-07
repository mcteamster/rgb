import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
    DailyChallenge,
    Submission,
    LeaderboardEntry,
    HSLColor
} from '../types/dailyChallenge';
import { dailyChallengeApi } from '../services/dailyChallengeApi';
import { getUserId, getUserName, setUserName, generateFingerprint } from '../utils/userId';

interface DailyChallengeState {
    currentChallenge: DailyChallenge | null;
    userSubmission: Submission | null;
    leaderboard: LeaderboardEntry[];
    isLoading: boolean;
    error: string | null;
}

interface DailyChallengeActions {
    loadCurrentChallenge: () => Promise<void>;
    submitColor: (color: HSLColor, userName: string) => Promise<void>;
    loadLeaderboard: (challengeId: string) => Promise<void>;
    clearError: () => void;
}

type DailyChallengeAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_CURRENT_CHALLENGE'; payload: { challenge: DailyChallenge; submission: Submission | null } }
    | { type: 'SET_USER_SUBMISSION'; payload: Submission }
    | { type: 'SET_LEADERBOARD'; payload: LeaderboardEntry[] };

const initialState: DailyChallengeState = {
    currentChallenge: null,
    userSubmission: null,
    leaderboard: [],
    isLoading: false,
    error: null
};

function dailyChallengeReducer(state: DailyChallengeState, action: DailyChallengeAction): DailyChallengeState {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        case 'SET_CURRENT_CHALLENGE':
            return {
                ...state,
                currentChallenge: action.payload.challenge,
                userSubmission: action.payload.submission,
                isLoading: false,
                error: null
            };
        case 'SET_USER_SUBMISSION':
            return { ...state, userSubmission: action.payload, isLoading: false };
        case 'SET_LEADERBOARD':
            return { ...state, leaderboard: action.payload, isLoading: false };
        default:
            return state;
    }
}

const DailyChallengeContext = createContext<(DailyChallengeState & DailyChallengeActions) | null>(null);

export const DailyChallengeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dailyChallengeReducer, initialState);

    const loadCurrentChallenge = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const userId = getUserId();
            const response = await dailyChallengeApi.getCurrentChallenge(userId);

            const challenge: DailyChallenge = {
                challengeId: response.challengeId,
                prompt: response.prompt,
                validFrom: response.validFrom,
                validUntil: response.validUntil,
                totalSubmissions: response.totalSubmissions
            };

            dispatch({
                type: 'SET_CURRENT_CHALLENGE',
                payload: { challenge, submission: response.userSubmission }
            });
        } catch (error) {
            console.error('Failed to load current challenge:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Failed to load challenge'
            });
        }
    };

    const submitColor = async (color: HSLColor, userName: string) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });

            if (!state.currentChallenge) {
                throw new Error('No active challenge');
            }

            const userId = getUserId();
            setUserName(userName);

            const response = await dailyChallengeApi.submitChallenge({
                challengeId: state.currentChallenge.challengeId,
                userId,
                userName,
                color,
                fingerprint: generateFingerprint()
            });

            const submission: Submission = {
                color,
                score: response.submission.score,
                submittedAt: response.submission.submittedAt,
                rank: response.submission.rank,
                distanceFromAverage: response.submission.distanceFromAverage,
                averageColor: response.submission.averageColor
            };

            dispatch({ type: 'SET_USER_SUBMISSION', payload: submission });
        } catch (error) {
            console.error('Failed to submit color:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Failed to submit color'
            });
            throw error;
        }
    };

    const loadLeaderboard = async (challengeId: string) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const userId = getUserId();
            const response = await dailyChallengeApi.getLeaderboard(challengeId, userId);
            dispatch({ type: 'SET_LEADERBOARD', payload: response.topScores });
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Failed to load leaderboard'
            });
        }
    };

    const clearError = () => {
        dispatch({ type: 'SET_ERROR', payload: null });
    };

    const value = {
        ...state,
        loadCurrentChallenge,
        submitColor,
        loadLeaderboard,
        clearError
    };

    return (
        <DailyChallengeContext.Provider value={value}>
            {children}
        </DailyChallengeContext.Provider>
    );
};

export const useDailyChallenge = () => {
    const context = useContext(DailyChallengeContext);
    if (!context) {
        throw new Error('useDailyChallenge must be used within DailyChallengeProvider');
    }
    return context;
};
