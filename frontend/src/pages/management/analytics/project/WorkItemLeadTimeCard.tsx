import { Hourglass } from "lucide-react";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProjectAnalyticsLeadTimePoint,
  ProjectAnalyticsLeadTimeSeriesKey,
  ProjectAnalyticsLeadTimeTrend,
} from "@/types/features/project-analytics";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-006 multi-series palette: Story = Blue, Subtask = Green, Task = Purple. */
const SERIES_CONFIG: ReadonlyArray<{
  key: ProjectAnalyticsLeadTimeSeriesKey;
  countKey: "storyCount" | "subtaskCount" | "taskCount";
  label: string;
  color: string;
}> = [
  { key: "story", countKey: "storyCount", label: "Story", color: "#2563EB" },
  { key: "subtask", countKey: "subtaskCount", label: "Subtask", color: "#7CB342" },
  { key: "task", countKey: "taskCount", label: "Task", color: "#A855F7" },
];

const SERIES_BY_KEY = Object.fromEntries(
  SERIES_CONFIG.map(series => [series.key, series]),
) as Record<ProjectAnalyticsLeadTimeSeriesKey, (typeof SERIES_CONFIG)[number]>;

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 11, borderRadius: 8, borderColor: GRID_COLOR },
  labelStyle: { fontSize: 11, fontWeight: 600 },
} as const;

/**
 * US-ANL-006: "Work item lead time" multi-series line chart (Story / Subtask / Task).
 *
 * Each point is one completion date (X axis, `YYYY-MM-DD`, tenant time zone)
 * with the mean end-to-end lead time `(t_DONE - created_at) / 86400` in days
 * per work item type. Types with zero completions on a date carry `null` and
 * render with `connectNulls={false}` so gaps never plot false zeros (AC01 / AC02).
 */
export function WorkItemLeadTimeCard({ trend }: { trend: ProjectAnalyticsLeadTimeTrend }) {
  const rows = trend?.points ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";

  return (
    <Card className="gap-0 rounded-xl py-0 shadow-xs">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
          >
            <Hourglass className="size-3.5" strokeWidth={2} />
          </span>
          <CardTitle className="truncate text-[13px] font-semibold tracking-tight">
            Work item lead time
          </CardTitle>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {SERIES_CONFIG.map(series => (
            <span
              key={series.key}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        <div className="relative h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="date"
                interval="preserveStartEnd"
                tick={{ fontSize: 10, fill: AXIS_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              >
                <Label
                  value="Work item completed date"
                  position="insideBottom"
                  offset={-16}
                  style={{ fontSize: 10, fill: AXIS_COLOR }}
                />
              </XAxis>
              <YAxis
                domain={[0, (dataMax: number) => (!Number.isFinite(dataMax) || dataMax <= 0 ? 1 : Math.ceil(dataMax))]}
                width={58}
                tick={{ fontSize: 10, fill: AXIS_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
              >
                <Label
                  value="Average work item lead time (days)"
                  angle={-90}
                  position="insideLeft"
                  offset={8}
                  style={{ fontSize: 10, fill: AXIS_COLOR, textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip
                {...TOOLTIP_STYLE}
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                labelFormatter={value => String(value)}
                formatter={(value, name, item) => {
                  if (value === null || value === undefined) {
                    return ["—", String(name ?? "")];
                  }
                  const key = item?.dataKey as ProjectAnalyticsLeadTimeSeriesKey | undefined;
                  const meta = key ? SERIES_BY_KEY[key] : undefined;
                  const payload = item?.payload as ProjectAnalyticsLeadTimePoint | undefined;
                  const count = meta && payload ? payload[meta.countKey] : 0;
                  return [
                    `${Number(value).toFixed(1)} days (${count} item${count === 1 ? "" : "s"})`,
                    meta?.label ?? String(name ?? ""),
                  ];
                }}
              />
              {SERIES_CONFIG.map(series => (
                <Line
                  key={series.key}
                  type="linear"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3.5, fill: series.color, stroke: "#ffffff", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: series.color, stroke: "#ffffff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">No work items completed in this window</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
