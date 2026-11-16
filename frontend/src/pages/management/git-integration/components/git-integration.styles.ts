import type { GitInstallationStatus, GitIntegrationSummaryStatus } from "@/types/features/git-integration";
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
  DISCONNECTED: {
    label: "Disconnected",
    badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
    accent: "border-l-slate-300 dark:border-l-slate-600",
  },
};
