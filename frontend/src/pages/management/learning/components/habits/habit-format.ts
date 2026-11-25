import { isAxiosError } from "axios";

export function dateOffset(date: string, days: number) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monday(date: string) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return dateOffset(date, -((day + 6) % 7));
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" })
    .format(new Date(date + "T00:00:00Z"));
}

export function duration(seconds: number) {
  if (seconds > 0 && seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return [hours && hours + "h", (minutes % 60 || !hours) && (minutes % 60) + "m"].filter(Boolean).join(" ");
}

export function timerDisplay(seconds: number) {
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return parts.slice(parts[0] ? 0 : 1).map(part => String(part).padStart(2, "0")).join(":");
}

export function habitError(error: unknown) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.length <= 250) return message;
    if (!error.response) return "Could not reach the server. Check your connection and try again.";
  }
  return error instanceof Error && !isAxiosError(error) ? error.message : "Something went wrong. Please try again.";
}
