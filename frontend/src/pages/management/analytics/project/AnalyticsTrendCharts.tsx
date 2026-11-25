import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ProjectAnalyticsBucket,
  ProjectAnalyticsGranularity,
  ProjectAnalyticsSeries,
  ProjectAnalyticsWidget,
} from "@/types/features/project-analytics";
import { ChartSkeleton, WidgetInlineError } from "./analytics-chart-ui";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SERIES_COLORS: Record<string, string> = {
  created: "#38bdf8",
  completed: "#10b981",
  todo: "#22c55e",
  inProgress: "#f59e0b",
  review: "#f43f5e",
  done: "#8b5cf6",
  remaining: "#4f46e5",
  ideal: "#f59e0b",
};

const SEGMENTS: { value: ProjectAnalyticsGranularity; label: string }[] = [
  { value: "DAY", label: "Day" },
  { value: "WEEK", label: "Week" },
  { value: "MONTH", label: "Month" },
];

type ChartRow = ProjectAnalyticsBucket & { label: string };

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function isoDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function bucketKey(date: string, granularity: ProjectAnalyticsGranularity) {
  if (granularity === "MONTH") return date.slice(0, 7);
  if (granularity === "WEEK") {
    const parsed = parseIsoDate(date);
    const offset = (parsed.getDay() + 6) % 7;
    parsed.setDate(parsed.getDate() - offset);
    return isoDate(parsed);
  }
  return date;
}

/**
 * Re-buckets the daily payload when the reader picks Week / Month on a card.
 * Activity counts accumulate; status snapshots keep the latest value of the
 * group, which is the state at the end of the bucket.
 */
function rebucket(buckets: ProjectAnalyticsBucket[], granularity: ProjectAnalyticsGranularity) {
  if (granularity === "DAY") return buckets;
  const grouped = new Map<string, ProjectAnalyticsBucket>();
  for (const bucket of buckets) {
    const key = bucketKey(bucket.date, granularity);
    const previous = grouped.get(key);
    grouped.set(key, previous
      ? {
          ...bucket,
          created: previous.created + bucket.created,
          completed: previous.completed + bucket.completed,
        }
      : { ...bucket });
  }
  return [...grouped.values()];
}

function formatBucket(date: string, granularity: ProjectAnalyticsGranularity) {
  const parsed = parseIsoDate(date);
  const label = `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
  if (granularity === "MONTH") return `${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
  if (granularity === "WEEK") return `Week of ${label}`;
  return label;
}

function colorOf(series: ProjectAnalyticsSeries, index: number) {
  return SERIES_COLORS[series.key] ?? ["#2563eb", "#f97316", "#a855f7", "#10b981"][index % 4];
}

function GranularitySwitch({ value, onChange }: {
  value: ProjectAnalyticsGranularity;
  onChange: (next: ProjectAnalyticsGranularity) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Chart granularity">
      {SEGMENTS.map(segment => (
        <button key={segment.value} type="button" aria-pressed={value === segment.value}
          onClick={() => onChange(segment.value)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
            value === segment.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}>
          {segment.label}
        </button>
      ))}
    </div>
  );
}

function visibleSeries(widget: ProjectAnalyticsWidget, rows: ChartRow[]) {
  // "Review" is only part of the status legend when the workflow actually used it.
  if (widget.kind === "AREA") {
    return widget.series.filter(item => item.key !== "review" || rows.some(row => row.review !== 0));
  }
  // The burndown mock-up reads "Ideal burndown" before the actual line.
  if (widget.kind === "LINE") {
    const ideal = widget.series.find(item => item.key === "ideal");
    const rest = widget.series.filter(item => item.key !== "ideal");
    return ideal ? [ideal, ...rest] : rest;
  }
  return widget.series;
}

function ChartLegend({ series }: { series: ProjectAnalyticsSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {series.map((item, index) => (
        <span key={item.key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {item.key === "ideal" ? (
            <span className="w-3 border-t border-dashed" style={{ borderColor: colorOf(item, index) }} />
          ) : (
            <span className="size-1.5 rounded-full" style={{ backgroundColor: colorOf(item, index) }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function TrendChart({ widget, rows }: { widget: ProjectAnalyticsWidget; rows: ChartRow[] }) {
  const axisProps = {
    tick: { fontSize: 9, fill: AXIS_COLOR },
    stroke: AXIS_COLOR,
    tickLine: false,
    axisLine: false,
  } as const;
  const tooltip = {
    contentStyle: { fontSize: 11, borderRadius: 8, borderColor: GRID_COLOR },
    labelStyle: { fontSize: 11, fontWeight: 600 },
  } as const;
  const margin = { top: 6, right: 8, bottom: 0, left: -24 };

  if (widget.kind === "AREA") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <Tooltip {...tooltip} />
          {visibleSeries(widget, rows).map((item, index) => (
            <Area key={item.key} type="monotone" dataKey={item.key} name={item.label}
              stroke={colorOf(item, index)} fill={colorOf(item, index)} fillOpacity={0.08}
              strokeWidth={1.5} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.kind === "LINE") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <Tooltip {...tooltip} />
          {widget.series.map((item, index) => (
            <Line key={item.key} type="monotone" dataKey={item.key} name={item.label}
              stroke={colorOf(item, index)} dot={false}
              strokeWidth={item.key === "ideal" ? 1.25 : 1.5}
              strokeDasharray={item.key === "ideal" ? "4 3" : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" interval="preserveStartEnd" {...axisProps} />
        <YAxis allowDecimals={false} width={32} {...axisProps} />
        <Tooltip {...tooltip} />
        {widget.series.map((item, index) => (
          <Bar key={item.key} dataKey={item.key} name={item.label} radius={[2, 2, 0, 0]}
            fill={colorOf(item, index)} maxBarSize={16} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChartCard({
  widget,
  granularity,
  isLoading = false,
  errorMessage,
  onRetry,
  retrying = false,
}: {
  widget: ProjectAnalyticsWidget;
  granularity: ProjectAnalyticsGranularity;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [selected, setSelected] = useState<ProjectAnalyticsGranularity>(granularity);
  const effective = selected === "DAY" && granularity !== "DAY" ? granularity : selected;
  const rows: ChartRow[] = rebucket(widget.buckets, effective)
    .map(bucket => ({ ...bucket, label: formatBucket(bucket.date, effective) }));
  const series = visibleSeries(widget, rows);
  const last = rows[rows.length - 1];
  const emptyMessage = widget.key === "work-items-completed"
    ? "No items completed in this window"
    : widget.key === "work-items-created"
      ? "No items created in this window"
      : "No work items in this window";
  const empty = rows.length === 0
    || widget.state === "EMPTY"
    || (widget.key === "work-items-completed" && rows.every(row => row.completed === 0))
    || (widget.key === "work-items-created" && rows.every(row => row.created === 0));
  const footer = widget.kind === "AREA" && last
    ? `${last.todo + last.inProgress + last.review + last.done} ${last.todo + last.inProgress + last.review + last.done === 1 ? "item" : "items"} total`
    : widget.kind === "LINE" && last
      ? `${last.remaining} ${last.remaining === 1 ? "item" : "items"} remaining`
      : null;

  return (
    <Card className="gap-0 rounded-xl py-0 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="text-[13px] font-semibold tracking-tight">{widget.title}</CardTitle>
        <GranularitySwitch value={selected} onChange={setSelected} />
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        {isLoading ? (
          <ChartSkeleton variant={widget.kind === "BAR" ? "bar" : "line"} className="h-[176px]" />
        ) : errorMessage ? (
          <div className="p-2">
            <WidgetInlineError message={errorMessage} onRetry={onRetry} retrying={retrying} className="min-h-[160px]" />
          </div>
        ) : (
        <>
        <div className="relative h-[176px] w-full">
          <TrendChart widget={widget} rows={rows} />
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">{emptyMessage}</p>
            </div>
          )}
        </div>
        {(widget.kind === "AREA" || widget.kind === "LINE") && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 pb-1 pt-1">
            <ChartLegend series={series} />
            {footer && <span className="text-[10px] text-muted-foreground">{footer}</span>}
          </div>
        )}
        </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * US-ANL-002: the four trend charts.
 *
 * The charts share the buckets of one payload, so they always agree with the
 * KPI cards and with each other after a scope change (AC01 / AC02 / AC03).
 */
export function AnalyticsTrendCharts({
  widgets,
  granularity,
  isLoading = false,
  errorMessage,
  onRetry,
  retrying = false,
}: {
  widgets: ProjectAnalyticsWidget[];
  granularity: ProjectAnalyticsGranularity;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <section aria-label="Analytics trend charts" className="grid gap-4 sm:grid-cols-2">
      {widgets.map(widget => (
        <TrendChartCard
          key={widget.key}
          widget={widget}
          granularity={granularity}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRetry={onRetry}
          retrying={retrying}
        />
      ))}
    </section>
  );
}
