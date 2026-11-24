import axios from "axios";

/**
 * Retry policy for queries: one retry for network/5xx hiccups, never for 4xx answers
 * (a 404 or 403 will not change by asking again and would only delay the error state).
 */
export const retryUnlessClientError = (failureCount: number, error: unknown): boolean => {
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
        return false;
    }

    return failureCount < 1;
};
