import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  primary: {
    surface: "from-indigo-500/20 via-violet-500/[0.08] to-sky-500/[0.05]",
    tile: "border-indigo-400/40 bg-gradient-to-br from-indigo-500/20 to-violet-500/15 text-indigo-600 dark:border-indigo-400/30 dark:text-indigo-300",
    border: "border-indigo-500/25 group-hover:border-indigo-500/55",
    chevron: "border-indigo-500/25 text-indigo-600 dark:border-indigo-400/30 dark:text-indigo-300",
    dot: "bg-indigo-500",
    value: "text-indigo-700 dark:text-indigo-200",
    bar: "bg-gradient-to-b from-indigo-500 via-violet-500 to-sky-500",
    glow: "bg-indigo-400/30",
  },
  warning: {
    surface: "from-amber-500/20 via-orange-500/[0.08] to-rose-500/[0.04]",
    tile: "border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-orange-500/15 text-amber-600 dark:border-amber-400/30 dark:text-amber-300",
    border: "border-amber-500/25 group-hover:border-amber-500/55",
    chevron: "border-amber-500/25 text-amber-600 dark:border-amber-400/30 dark:text-amber-300",
    dot: "bg-amber-500",
    value: "text-amber-700 dark:text-amber-200",
    bar: "bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500",
    glow: "bg-amber-400/30",
  },
  success: {
    surface: "from-emerald-500/20 via-teal-500/[0.08] to-lime-500/[0.04]",
    tile: "border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-teal-500/15 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300",
    border: "border-emerald-500/25 group-hover:border-emerald-500/55",
    chevron: "border-emerald-500/25 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
    value: "text-emerald-700 dark:text-emerald-200",
    bar: "bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-500",
    glow: "bg-emerald-400/30",
  },
} as const;

/**
 * Clickable summary tile used by the team-allocation session overview.
 * Shared between the class page (session overview) and other allocation views.
 */
export function MetricCard({
  icon,
  label,
  hint,
  value,
  tone = "primary",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  value: number;
  tone?: "primary" | "warning" | "success";
  onClick: () => void;
}) {
  const style = TONES[tone];

  return (
    <button
      type="button"
      className="group rounded-2xl text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${hint ?? "Nhấn để xem chi tiết."}`}
    >
      <Card
        className={cn(
          "relative h-full gap-0 overflow-hidden py-4 shadow-sm transition-all duration-200 group-hover:shadow-lg",
          style.border,
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-95",
            style.surface,
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1.5 opacity-80 transition-opacity duration-200 group-hover:opacity-100",
            style.bar,
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-8 -top-10 size-24 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
            style.glow,
          )}
        />
        <CardContent className="relative flex items-center gap-3.5 pl-5 pr-4">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-200 group-hover:scale-105",
              style.tile,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  "text-2xl font-bold leading-none tracking-tight tabular-nums",
                  style.value,
                )}
              >
                {value}
              </p>
              <span className={cn("size-1.5 rounded-full opacity-60", style.dot)} />
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground/80">
              {label}
            </p>
            {hint && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border bg-background/70 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100",
              style.chevron,
            )}
          >
            <ChevronRight className="size-4" />
          </span>
        </CardContent>
      </Card>
    </button>
  );
}
