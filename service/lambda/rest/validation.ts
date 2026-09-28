/**
 * Shared validation utilities for REST handler inputs.
 *
 * A single source of truth for the user-id format so all three handlers
 * (get-user-history, get-stats, submit-challenge) agree on what an
 * acceptable id looks like.
 */

/** Minimum length for a valid userId (after trimming). */
export const USER_ID_MIN = 8;

/** Maximum length for a valid userId (after trimming). */
export const USER_ID_MAX = 64;

/**
 * Charset pattern for a valid userId.
 * Accepts alphanumeric characters plus the url-safe separators `.`, `_`, `-`.
 * No whitespace, control characters, or expression metacharacters are allowed.
 */
export const USER_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Validate and normalise a userId value from an untrusted source.
 *
 * - Accepts only string input (non-strings are rejected).
 * - Trims leading/trailing whitespace before validating.
 * - Returns the trimmed string when it satisfies length and charset
 *   constraints, or `null` when it does not.
 *
 * Handlers should return HTTP 400 `{ error: 'Invalid userId' }` when
 * this function returns `null`, and use the returned string value for
 * any downstream query or write.
 */
export function validateUserId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length < USER_ID_MIN || trimmed.length > USER_ID_MAX) {
        return null;
    }
    if (!USER_ID_PATTERN.test(trimmed)) {
        return null;
    }
    return trimmed;
}
