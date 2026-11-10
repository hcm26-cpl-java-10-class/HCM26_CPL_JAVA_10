import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  primary: {
    surface: "from-primary/10 via-primary/[0.03] to-transparent",
    tile: "border-primary/20 bg-primary/10 text-primary",
    border: "group-hover:border-primary/40",
    chevron: "border-primary/20 text-primary",
    dot: "bg-primary",
  },
  warning: {
    surface: "from-amber-500/10 via-amber-500/[0.03] to-transparent",
    tile: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "group-hover:border-amber-500/40",
    chevron: "border-amber-500/20 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  success: {
    surface: "from-emerald-500/10 via-emerald-500/[0.03] to-transparent",
    tile: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    border: "group-hover:border-emerald-500/40",
    chevron: "border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
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
          "relative h-full gap-0 overflow-hidden py-4 shadow-sm transition-all duration-200 group-hover:shadow-md",
          style.border,
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
            style.surface,
          )}
        />
        <CardContent className="relative flex items-center gap-3.5 px-4">
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
              <p className="text-2xl font-bold leading-none tracking-tight tabular-nums">
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
