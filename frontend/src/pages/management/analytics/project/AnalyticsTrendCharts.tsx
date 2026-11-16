import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Layers3,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProjectAnalyticsGranularity,
  ProjectAnalyticsWidget,
} from "@/types/features/project-analytics";

const WIDGET_ICONS: Record<string, LucideIcon> = {
  "work-items-created": BarChart3,
  "work-items-completed": CheckCircle2,
  "status-cumulative-flow": Layers3,
  "sprint-burndown": LineChart,
};

const SERIES_COLORS = ["#2563eb", "#f97316", "#a855f7", "#10b981", "#ef4444", "#0ea5e9"];
const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e2e8f0";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Axis label: day buckets show "16 Nov", week buckets "Week of 16 Nov", month buckets "Nov 2026". */
function formatBucket(date: string, granularity: ProjectAnalyticsGranularity) {
  const parsed = parseIsoDate(date);
  const label = `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
  if (granularity === "MONTH") return `${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
  if (granularity === "WEEK") return `Week of ${label}`;
  return label;
}

function TrendChart({ widget, granularity }: {
  widget: ProjectAnalyticsWidget;
  granularity: ProjectAnalyticsGranularity;
}) {
  const rows = widget.buckets.map(bucket => ({ ...bucket, label: formatBucket(bucket.date, granularity) }));
  const axisProps = {
    tick: { fontSize: 10, fill: AXIS_COLOR },
    stroke: AXIS_COLOR,
    tickLine: false,
    axisLine: false,
  } as const;
  const tooltip = {
    contentStyle: { fontSize: 11, borderRadius: 8, borderColor: GRID_COLOR },
    labelStyle: { fontSize: 11, fontWeight: 600 },
  } as const;

  if (widget.kind === "AREA") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip {...tooltip} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          {widget.series.map((series, index) => (
            <Area key={series.key} type="monotone" dataKey={series.key} name={series.label} stackId="status"
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]} fillOpacity={0.25} strokeWidth={1.5} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.kind === "LINE") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip {...tooltip} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          {widget.series.map((series, index) => (
            <Line key={series.key} type="monotone" dataKey={series.key} name={series.label}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]} dot={false}
              strokeWidth={series.key === "ideal" ? 1.5 : 2}
              strokeDasharray={series.key === "ideal" ? "4 4" : undefined} />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltip} />
        {widget.series.map((series, index) => (
          <Bar key={series.key} dataKey={series.key} name={series.label} radius={[3, 3, 0, 0]}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChartCard({ widget, granularity }: {
  widget: ProjectAnalyticsWidget;
  granularity: ProjectAnalyticsGranularity;
}) {
  const Icon = WIDGET_ICONS[widget.key] ?? BarChart3;
  const empty = widget.state === "EMPTY" || widget.buckets.length === 0;
  return (
    <Card className="shadow-xs">
      <CardHeader className="flex-row items-start gap-2.5">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-sm">{widget.title}</CardTitle>
          <CardDescription className="text-[11px] leading-5">{widget.description}</CardDescription>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">{granularity}</Badge>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-52 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 text-center">
            <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-[11px] font-medium text-muted-foreground">No work items in this scope</p>
            <p className="text-[10px] text-muted-foreground/80">Widen the scope or pick another date range.</p>
          </div>
        ) : (
          <div className="h-52 w-full">
            <TrendChart widget={widget} granularity={granularity} />
          </div>
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
export function AnalyticsTrendCharts({ widgets, granularity }: {
  widgets: ProjectAnalyticsWidget[];
  granularity: ProjectAnalyticsGranularity;
}) {
  return (
    <section aria-label="Analytics trend charts" className="grid gap-4 xl:grid-cols-2">
      {widgets.map(widget => (
        <TrendChartCard key={widget.key} widget={widget} granularity={granularity} />
      ))}
    </section>
  );
}
