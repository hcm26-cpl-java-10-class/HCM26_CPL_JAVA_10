import axios from "axios";

export type ApiErrorKind =
    | "network"
    | "unauthorized"
    | "forbidden"
    | "notFound"
    | "validation"
    | "conflict"
    | "upstream"
    | "server"
    | "unknown";

export interface ApiErrorInfo {
    kind: ApiErrorKind;
    status?: number;
    /** A sentence that is safe to show to the user. */
    message: string;
    /** Field -> messages, as returned by the backend for 400 responses. */
    fieldErrors: Record<string, string[]>;
}

interface ErrorBody {
    message?: unknown;
    errors?: unknown;
}

const asMessage = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value : undefined;

const asFieldErrors = (value: unknown): Record<string, string[]> => {
    if (typeof value !== "object" || value === null) return {};

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages.filter((item): item is string => typeof item === "string") : [],
        ]),
    );
};

/**
 * Turns whatever a request threw into one predictable shape, so every page and dialog reports
 * 400 / 401 / 403 / 404 / 409 / 5xx / network failures the same way.
 */
export function describeApiError(error: unknown, fallback = "Something went wrong. Please try again."): ApiErrorInfo {
    if (!axios.isAxiosError(error)) {
        return { kind: "unknown", message: error instanceof Error && error.message ? error.message : fallback, fieldErrors: {} };
    }

    if (!error.response) {
        return {
            kind: "network",
            message: "Cannot reach the server. Check your connection and try again.",
            fieldErrors: {},
        };
    }

    const status = error.response.status;
    const body = (error.response.data ?? {}) as ErrorBody;
    const serverMessage = asMessage(body.message);
    const fieldErrors = asFieldErrors(body.errors);

    switch (status) {
        case 400:
            return { kind: "validation", status, message: serverMessage ?? "Some of the entered values are not valid.", fieldErrors };
        case 401:
            return { kind: "unauthorized", status, message: "Your session has expired. Please sign in again.", fieldErrors: {} };
        case 403:
            return { kind: "forbidden", status, message: "You don't have permission to do this.", fieldErrors: {} };
        case 404:
            return {
                kind: "notFound",
                status,
                message: "This record no longer exists. It may have been deleted, so refresh the page.",
                fieldErrors: {},
            };
        case 409:
            return { kind: "conflict", status, message: serverMessage ?? "This change conflicts with existing data.", fieldErrors: {} };
        case 502:
        case 503:
            return {
                kind: "upstream",
                status,
                message: "The master training system could not be reached. Nothing was changed; please try again later.",
                fieldErrors: {},
            };
        default:
            return status >= 500
                ? { kind: "server", status, message: `The server ran into a problem (${status}). Please try again later.`, fieldErrors: {} }
                : { kind: "unknown", status, message: serverMessage ?? fallback, fieldErrors };
    }
}
