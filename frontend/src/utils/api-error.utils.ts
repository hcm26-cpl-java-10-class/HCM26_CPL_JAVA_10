import axios from "axios";

/** Shape of the error body returned by the backend (see `SessionAuditErrorResponse`). */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  errors?: Record<string, string[]>;
  /** T2 / AC T2-06 — correlation ID to cross-check the error with the server log. */
  correlationId?: string;
}

export const getApiErrorBody = (error: unknown): ApiErrorBody | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.data as ApiErrorBody | undefined;
};

/**
 * Turns an axios error into the most useful message available:
 * first field error → `message` → the JS error message → fallback.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const body = getApiErrorBody(error);

  const fieldErrors = body?.fieldErrors ?? body?.errors;
  const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0] : undefined;
  if (Array.isArray(firstFieldError) && firstFieldError.length > 0) {
    return firstFieldError[0];
  }

  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

/** Correlation ID of the failed request (SRS §8.1) — shown so users can quote it to support. */
export const getApiErrorCorrelationId = (error: unknown): string | undefined => {
  const body = getApiErrorBody(error);
  if (body?.correlationId) return body.correlationId;

  if (!axios.isAxiosError(error)) return undefined;
  const header = error.response?.headers?.["x-correlation-id"];
  return typeof header === "string" ? header : undefined;
};
