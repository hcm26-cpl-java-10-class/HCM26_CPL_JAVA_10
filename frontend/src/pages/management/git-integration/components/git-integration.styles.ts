import type { GitInstallationStatus, GitIntegrationSummaryStatus, GitPullRequestState } from "@/types/features/git-integration";
import type { GitIntegrationTone } from "../git-integration.messages";

/**
 * Colour is only used where it carries meaning: the module tile, status badges
 * and result screens. Every class has a dark-mode pair.
 */
export const TONE_STYLES: Record<GitIntegrationTone, { tile: string; ring: string; text: string }> = {
  success: {
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    ring: "border-emerald-200 dark:border-emerald-900",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    tile: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    ring: "border-amber-200 dark:border-amber-900",
    text: "text-amber-700 dark:text-amber-300",
  },
  error: {
    tile: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300",
    ring: "border-red-200 dark:border-red-900",
    text: "text-red-700 dark:text-red-300",
  },
  neutral: {
    tile: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    ring: "border-slate-200 dark:border-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  },
  info: {
    tile: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    ring: "border-blue-100 dark:border-blue-900",
    text: "text-blue-700 dark:text-blue-300",
  },
};

type AnyStatus = GitIntegrationSummaryStatus | GitInstallationStatus;

export const STATUS_STYLES: Record<AnyStatus, { label: string; badge: string; dot: string; accent: string }> = {
  CONNECTED: {
    label: "Connected",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
    accent: "border-l-emerald-500",
  },
  SUSPENDED: {
    label: "Suspended",
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
    accent: "border-l-amber-500",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
    accent: "border-l-slate-300 dark:border-l-slate-600",
  },
  ERROR: {
    label: "Error",
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
    dot: "bg-red-500",
    accent: "border-l-red-500",
  },
  DISCONNECTED: {
    label: "Disconnected",
    badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
    accent: "border-l-slate-300 dark:border-l-slate-600",
  },
};

/**
 * US-TM-03: 2px left accent of a pull request row, the same hue as its state badge
 * (GitHub colours). Lively without tinting the whole row; the badge still carries the text.
 */
export function pullRequestAccent(state: GitPullRequestState, draft?: boolean) {
  if (state === "OPEN" && draft) return "border-l-2 border-l-slate-300 dark:border-l-slate-600";
  if (state === "OPEN") return "border-l-2 border-l-emerald-500 dark:border-l-emerald-400";
  if (state === "MERGED") return "border-l-2 border-l-violet-500 dark:border-l-violet-400";
  return "border-l-2 border-l-red-400 dark:border-l-red-500";
}

/** US-TM-03: small state dot of a pull request in the link picker. */
export function pullRequestDot(state: GitPullRequestState, draft?: boolean) {
  if (state === "OPEN" && draft) return "bg-slate-400";
  if (state === "OPEN") return "bg-emerald-500";
  if (state === "MERGED") return "bg-violet-500";
  return "bg-red-400";
}

/**
 * WS-GH-01: soft avatar tone of a contributor, stable per login. Six light hues so a
 * list of authors reads lively without any of them shouting.
 */
const CONTRIBUTOR_TONES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

function toneIndex(login?: string | null) {
  let hash = 0;
  for (const char of (login ?? "").toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % CONTRIBUTOR_TONES.length;
}

export function contributorTone(login?: string | null) {
  return CONTRIBUTOR_TONES[toneIndex(login)];
}

/** WS-GH-02: ratio bar of a contributor, in the same hue as their avatar (track = lighter step of that ramp). */
const CONTRIBUTOR_BARS = [
  { track: "bg-sky-100 dark:bg-sky-950", bar: "bg-sky-500 dark:bg-sky-500" },
  { track: "bg-emerald-100 dark:bg-emerald-950", bar: "bg-emerald-500 dark:bg-emerald-500" },
  { track: "bg-violet-100 dark:bg-violet-950", bar: "bg-violet-500 dark:bg-violet-500" },
  { track: "bg-amber-100 dark:bg-amber-950", bar: "bg-amber-500 dark:bg-amber-500" },
  { track: "bg-rose-100 dark:bg-rose-950", bar: "bg-rose-500 dark:bg-rose-500" },
  { track: "bg-teal-100 dark:bg-teal-950", bar: "bg-teal-500 dark:bg-teal-500" },
];

export function contributorBar(login?: string | null) {
  return CONTRIBUTOR_BARS[toneIndex(login)];
}

/** WS-GH-02: ratio bar of a branch (commit hue). */
export const BRANCH_BAR = { track: "bg-sky-100 dark:bg-sky-950", bar: "bg-sky-600 dark:bg-sky-600" };

/**
 * WS-GH-02: colours of the commit activity chart, as CSS variables defined in `index.css`
 * for light and dark (validated with the dataviz palette checks against the card surface:
 * bars sky-600 in both modes, merged-PR dots violet-600 light / violet-500 dark).
 */
export const CHART_COLORS = {
  bar: "var(--gh-chart-bar)",
  barActive: "var(--gh-chart-bar-active)",
  merged: "var(--gh-chart-merged)",
  grid: "var(--gh-chart-grid)",
  surface: "var(--card)",
} as const;

/** WS-GH-01: icon chip of a stat tile; only the chip is coloured, never the whole tile. */
export const STAT_TONES = {
  commit: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  linked: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  open: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  review: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  merged: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;
