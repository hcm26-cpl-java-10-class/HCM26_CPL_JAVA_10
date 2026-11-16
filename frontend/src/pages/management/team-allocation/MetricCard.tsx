import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Feedback-only tones: the surface stays neutral so the colour of the icon,
 * dot and border is the only signal of the state (needs attention / resolved).
 */
const TONES = {
  primary: {
    border: "border-border group-hover:border-foreground/20",
    tile: "border-border bg-muted text-muted-foreground group-hover:text-foreground",
    dot: "bg-muted-foreground/40",
    chevron: "border-border text-muted-foreground",
  },
  warning: {
    border: "border-amber-500/30 group-hover:border-amber-500/50",
    tile: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    chevron: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
  success: {
    border: "border-emerald-500/25 group-hover:border-emerald-500/45",
    tile: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    chevron: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
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
      className="group rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${hint ?? "Nhấn để xem chi tiết."}`}
    >
      <Card
        className={cn(
          "h-full gap-0 border py-4 shadow-sm transition-shadow duration-200 group-hover:shadow-md",
          style.border,
        )}
      >
        <CardContent className="flex items-center gap-3 px-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
              style.tile,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
                {value}
              </p>
              <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs font-medium text-foreground">
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
              "flex size-6 shrink-0 items-center justify-center rounded-full border bg-background opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
              style.chevron,
            )}
          >
            <ChevronRight className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </button>
  );
}
