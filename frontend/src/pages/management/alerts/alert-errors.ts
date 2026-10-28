import axios from "axios";

export function getAlertError(error: unknown): {
  status?: number; message: string; fieldErrors: Record<string, string[]>;
} {
  if (!axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    return { message: "Unable to load or queue alerts. Please try again.", fieldErrors: {} };
  }
  const status = error.response?.status;
  const fallback: Record<number, string> = {
    401: "Your session has expired. Please sign in again.",
    403: "Your access to this alert category or team has changed.",
    404: "This item does not exist or has been changed.",
    409: "The selected data has changed. Reload the list before retrying.",
    422: "Please check the highlighted fields.",
  };
  return {
    status,
    message: error.response?.data?.message || (status && fallback[status]) || "Unable to connect to the server. Please try again.",
    fieldErrors: error.response?.data?.errors ?? {},
  };
}
