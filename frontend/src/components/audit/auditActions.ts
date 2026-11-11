/**
 * Single source of truth for how audit actions look (label + colour).
 * An action that is not listed here still works: its label is derived from its name
 * and it gets a neutral colour, so a new backend action needs no frontend change.
 */

type Tone =
  | "emerald" | "blue" | "red" | "violet" | "slate"
  | "teal" | "amber" | "indigo" | "sky" | "orange" | "gray";

const TONE_STYLES: Record<Tone, { badge: string; dot: string }> = {
  emerald: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  blue: { badge: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  red: { badge: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  slate: { badge: "bg-slate-100 text-slate-700 ring-slate-500/20", dot: "bg-slate-500" },
  teal: { badge: "bg-teal-50 text-teal-700 ring-teal-600/20", dot: "bg-teal-500" },
  amber: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  indigo: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", dot: "bg-indigo-500" },
  sky: { badge: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  orange: { badge: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  gray: { badge: "bg-gray-100 text-gray-700 ring-gray-500/20", dot: "bg-gray-400" },
};

const ACTION_META: Record<string, { label?: string; tone: Tone }> = {
  CREATE: { tone: "emerald" },
  UPDATE: { tone: "blue" },
  DELETE: { tone: "red" },
  LOGIN: { tone: "violet" },
  LOGOUT: { tone: "slate" },
  REGISTER: { tone: "teal" },
  VERIFY_EMAIL: { tone: "teal" },
  FORGOT_PASSWORD: { tone: "amber" },
  RESET_PASSWORD: { tone: "amber" },
  IMPORT: { tone: "indigo" },
  EXPORT: { tone: "indigo" },
  ADD_QUESTION: { tone: "sky" },
  REMOVE_QUESTION: { tone: "orange" },
  CANCEL: { tone: "orange" },
  INVITE: { tone: "sky" },
  BATCH_INVITE: { tone: "sky" },
  RESEND: { tone: "sky" },
  REVOKE: { tone: "red" },
};

/** Actions the UI knows about; used until the real list is loaded from the server. */
export const KNOWN_ACTIONS = Object.keys(ACTION_META);

function humanize(action: string) {
  const text = action.toLowerCase().split("_").join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toneOf(action: string) {
  return TONE_STYLES[ACTION_META[action?.toUpperCase()]?.tone ?? "gray"];
}

export function getActionLabel(action: string) {
  if (!action) return "Unknown";
  return ACTION_META[action.toUpperCase()]?.label ?? humanize(action);
}

export function getActionBadgeClass(action: string) {
  return toneOf(action).badge;
}

export function getActionDotClass(action: string) {
  return toneOf(action).dot;
}
