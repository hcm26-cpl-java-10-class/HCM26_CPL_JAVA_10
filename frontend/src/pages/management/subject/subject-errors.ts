import axios from "axios";

export function subjectError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    const body = error.response?.data;
    if (body?.errors) {
      const messages = Object.values(body.errors).flat();
      if (messages.length) return messages.join(" ");
    }
    if (typeof body?.message === "string") return body.message;
  }
  return fallback;
}
