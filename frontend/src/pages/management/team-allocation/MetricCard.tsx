import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Clickable summary tile used by the team-allocation session overview.
 * Shared between the class page (session overview) and other allocation views.
 */
export function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "primary" | "warning" | "success";
  onClick: () => void;
}) {
  const tones: Record<
    "primary" | "warning" | "success",
    { tile: string; border: string; chevron: string }
  > = {
    primary: {
      tile: "bg-primary/10 text-primary",
      border: "group-hover:border-primary/40",
      chevron: "text-primary",
    },
    warning: {
      tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      border: "group-hover:border-amber-500/40",
      chevron: "text-amber-600 dark:text-amber-400",
    },
    success: {
      tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      border: "group-hover:border-emerald-500/40",
      chevron: "text-emerald-600 dark:text-emerald-400",
    },
  };
  const style = tones[tone];

  return (
    <button
      type="button"
      className="group rounded-xl text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`${label}: ${value}. Nhấn để xem chi tiết.`}
    >
      <Card className={`h-full gap-0 py-4 transition-all duration-200 group-hover:shadow-md ${style.border}`}>
        <CardContent className="flex items-center gap-3.5 px-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${style.tile}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold leading-tight tracking-tight tabular-nums">{value}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{label}</p>
          </div>
          <ChevronRight className={`size-4 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 ${style.chevron}`} />
        </CardContent>
      </Card>
    </button>
  );
}
