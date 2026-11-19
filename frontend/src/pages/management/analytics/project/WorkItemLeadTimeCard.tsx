import { useState } from "react";
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
  ProjectAnalyticsDrillDownTarget,
  ProjectAnalyticsLeadTimePoint,
  ProjectAnalyticsLeadTimeSeriesKey,
  ProjectAnalyticsLeadTimeTrend,
} from "@/types/features/project-analytics";
import {
  ChartSkeleton,
  LegendToggleButton,
  MetricLineTooltip,
  WidgetInlineError,
} from "./analytics-chart-ui";

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

/**
 * US-ANL-006 / US-ANL-008: "Work item lead time" multi-series line chart
 * (Story / Subtask / Task) with interactive hover tooltips, legend series
 * toggling with Y-axis rescaling (AC02), and click-to-drill-down on node markers.
 */
export function WorkItemLeadTimeCard({
  trend,
  onDrillDown,
  isLoading = false,
  errorMessage,
  onRetry,
  retrying = false,
}: {
  trend?: ProjectAnalyticsLeadTimeTrend;
  onDrillDown?: (target: ProjectAnalyticsDrillDownTarget) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [visible, setVisible] = useState<Record<ProjectAnalyticsLeadTimeSeriesKey, boolean>>({
    story: true,
    subtask: true,
    task: true,
  });
  const rows = trend?.points ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";
  const allHidden = !visible.story && !visible.subtask && !visible.task;

  const toggle = (key: ProjectAnalyticsLeadTimeSeriesKey) => {
    setVisible(current => ({ ...current, [key]: !current[key] }));
  };

  // US-ANL-008 AC02: compute Y-axis upper bound strictly from currently visible series.
  const maxVisibleDays = rows.reduce((max, row) => {
    let next = max;
    for (const series of SERIES_CONFIG) {
      if (!visible[series.key]) continue;
      const value = row[series.key];
      if (typeof value === "number" && Number.isFinite(value) && value > next) {
        next = value;
      }
    }
    return next;
  }, 0);
  const yDomainMax = maxVisibleDays <= 0 ? 1 : Math.ceil(maxVisibleDays);

  const openDrillDown = (date?: string, series?: ProjectAnalyticsLeadTimeSeriesKey) => {
    if (date && onDrillDown) {
      onDrillDown({ chart: "lead-time", date, series });
    }
  };

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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {SERIES_CONFIG.map(series => (
            <LegendToggleButton
              key={series.key}
              color={series.color}
              label={series.label}
              shape="dot"
              visible={visible[series.key]}
              onToggle={() => toggle(series.key)}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        {isLoading ? (
          <ChartSkeleton variant="line" />
        ) : errorMessage ? (
          <div className="p-2">
            <WidgetInlineError message={errorMessage} onRetry={onRetry} retrying={retrying} className="h-[204px]" />
          </div>
        ) : (
        <div className="relative h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
              onClick={state => {
                if (!allHidden && state?.activeLabel != null) {
                  openDrillDown(String(state.activeLabel));
                }
              }}
            >
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
                domain={[0, yDomainMax]}
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
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                content={({ active, label, payload }) => (
                  <MetricLineTooltip
                    active={active}
                    label={label}
                    payload={payload}
                    countResolver={entry => {
                      const key = entry.dataKey as ProjectAnalyticsLeadTimeSeriesKey | undefined;
                      const meta = key ? SERIES_BY_KEY[key] : undefined;
                      const point = entry.payload as ProjectAnalyticsLeadTimePoint | undefined;
                      return meta && point ? point[meta.countKey] : undefined;
                    }}
                  />
                )}
              />
              {SERIES_CONFIG.map(series =>
                visible[series.key] ? (
                  <Line
                    key={series.key}
                    type="linear"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2}
                    connectNulls={false}
                    dot={{ r: 3.5, fill: series.color, stroke: "#ffffff", strokeWidth: 1.5 }}
                    activeDot={props => {
                      if (typeof props.cx !== "number" || typeof props.cy !== "number") {
                        return null;
                      }
                      const pointDate = (props.payload as { date?: string } | undefined)?.date;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5.5}
                          fill={series.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                          className={onDrillDown ? "cursor-pointer" : undefined}
                          onClick={event => {
                            event.stopPropagation();
                            openDrillDown(pointDate, series.key);
                          }}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
          {(empty || allHidden) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">
                {empty ? "No work items completed in this window" : "All series hidden — click a legend item to show"}
              </p>
            </div>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
