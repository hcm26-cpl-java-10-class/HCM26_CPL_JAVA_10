import { BadgeCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/** US-GI-06: emerald = connected; amber outline = still to connect. One meaning per colour. */
export const ACCOUNT_TONES = {
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  pending: "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  neutral: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
} as const;

export function GitHubAccountChip({ login, title, className }: { login: string | null; title?: string; className?: string }) {
  return <span title={title}
    className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", ACCOUNT_TONES.connected, className)}>
    <BadgeCheck className="size-3.5 shrink-0" aria-hidden="true" />
    <span className="truncate">@{login ?? "github"}</span>
  </span>;
}

export function NotConnectedChip({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium", ACCOUNT_TONES.pending, className)}>
    <CircleDashed className="size-3.5 shrink-0" aria-hidden="true" />Not connected
  </span>;
}
