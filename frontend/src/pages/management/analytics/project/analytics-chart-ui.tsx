import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * US-ANL-008 AC02: clickable legend item that toggles a chart series on/off.
 * Hidden series dim to 40% opacity (`opacity-40`) while remaining keyboard and
 * pointer accessible to toggle back on.
 */
export function LegendToggleButton({
  color,
  label,
  visible,
  shape = "dot",
  onToggle,
}: {
  color: string;
  label: string;
  visible: boolean;
  shape?: "dot" | "square";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={visible}
      aria-label={`${visible ? "Hide" : "Show"} ${label} series`}
      onClick={onToggle}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        !visible && "opacity-40 line-through decoration-muted-foreground/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0", shape === "square" ? "rounded-[2px]" : "rounded-full")}
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </button>
  );
}

export interface ChartTooltipPayloadItem {
  dataKey?: unknown;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: unknown;
}

/**
 * US-ANL-008 AC01: floating hover tooltip for stacked bar charts showing
 * formatted Date, each visible series with exact count and percentage share,
 * and the visible stacked Total (e.g. `Date: 2026-10-29 | Done: 10 (52.6%) | To Do: 9 (47.4%) | Total: 19`).
 */
export function StackedBarTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entries = payload
    .filter(item => item.value !== null && item.value !== undefined)
    .map(item => ({
      key: String(item.dataKey ?? item.name ?? ""),
      name: String(item.name ?? item.dataKey ?? ""),
      color: item.color ?? "#2563EB",
      value: Number(item.value),
    }));
  if (entries.length === 0) {
    return null;
  }
  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-popover px-3 py-2 text-[11px] text-popover-foreground shadow-md dark:border-border">
      <p className="mb-1.5 font-semibold text-foreground">Date: {String(label ?? "")}</p>
      <div className="space-y-1">
        {entries.map(entry => {
          const share = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={entry.key} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-medium text-foreground">
                {entry.value} ({share}%)
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5 font-semibold text-foreground tabular-nums">
        <span>Total:</span>
        <span>{total}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Click a bar segment to inspect work items</p>
    </div>
  );
}

/**
 * US-ANL-008 AC01: floating hover tooltip for line charts showing formatted Date,
 * each visible series' exact average days to 1 decimal place, and completed item count.
 */
export function MetricLineTooltip({
  active,
  label,
  payload,
  countResolver,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
  countResolver: (entry: ChartTooltipPayloadItem) => number | undefined;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entries = payload.filter(item => item.value !== null && item.value !== undefined);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-popover px-3 py-2 text-[11px] text-popover-foreground shadow-md dark:border-border">
      <p className="mb-1.5 font-semibold text-foreground">Date: {String(label ?? "")}</p>
      <div className="space-y-1">
        {entries.map(entry => {
          const count = countResolver(entry);
          return (
            <div
              key={String(entry.dataKey ?? entry.name ?? "")}
              className="flex items-center justify-between gap-4 tabular-nums"
            >
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color ?? "#2563EB" }}
                />
                {String(entry.name ?? entry.dataKey ?? "")}:
              </span>
              <span className="font-medium text-foreground">
                {Number(entry.value).toFixed(1)} days
                {typeof count === "number" ? ` (${count} item${count === 1 ? "" : "s"})` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 border-t pt-1 text-[10px] text-muted-foreground">
        Click a node marker to inspect work items
      </p>
    </div>
  );
}

/**
 * US-ANL-009 AC01: smooth animated skeleton loader rendered inside chart
 * containers while analytics data is loading so '0' or empty states never flash.
 */
export function ChartSkeleton({
  variant = "bar",
  className,
}: {
  variant?: "bar" | "line";
  className?: string;
}) {
  const heights = variant === "bar"
    ? ["h-16", "h-24", "h-12", "h-28", "h-20", "h-24", "h-14"]
    : ["h-10", "h-16", "h-14", "h-24", "h-18", "h-20", "h-12"];

  return (
    <div
      role="status"
      aria-label="Loading chart"
      className={cn("flex h-[220px] w-full flex-col justify-between px-4 pb-4 pt-3", className)}
    >
      <div className="flex flex-1 items-end gap-3 border-b border-l border-border/60 px-4 pb-3 pt-4">
        {heights.map((height, idx) => (
          <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            {variant === "line" ? (
              <>
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className={cn("w-full max-w-[28px] rounded-t opacity-45", height)} />
              </>
            ) : (
              <Skeleton className={cn("w-full max-w-[32px] rounded-t", height)} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 px-4">
        {[0, 1, 2, 3, 4].map(idx => (
          <Skeleton key={idx} className="h-2.5 w-12 rounded" />
        ))}
      </div>
    </div>
  );
}

/**
 * US-ANL-009 AC03: user-friendly inline error banner inside an affected widget
 * with a scoped 'Retry' button and no raw stack traces.
 */
export function WidgetInlineError({
  message = "Unable to load this widget right now. Please try again.",
  onRetry,
  retrying = false,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex h-full min-h-[160px] flex-col items-center justify-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-6 text-center",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
      </span>
      <p className="max-w-sm text-xs leading-5 text-foreground">{message}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={retrying}
          className="h-7 gap-1.5 text-[11px]"
          onClick={onRetry}
        >
          <RefreshCw className={cn("size-3", retrying && "animate-spin")} />
          Retry
        </Button>
      )}
    </div>
  );
}
