const USER_ID_KEY = 'rgb-daily-user-id';
const USER_NAME_KEY = 'rgb-daily-user-name';

export function getUserId(): string {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        // Generate UUID v4
        userId = 'anon_' + crypto.randomUUID();
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

export function getUserName(): string {
    return localStorage.getItem(USER_NAME_KEY) || '';
}

export function setUserName(name: string): void {
    localStorage.setItem(USER_NAME_KEY, name);
}

export function generateFingerprint(): string {
    // Simple browser fingerprint (can be enhanced)
    const data = [
        navigator.userAgent,
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
    ].join('|');

    // Return hash (use simple encoding for now)
    return btoa(data).substring(0, 32);
}
