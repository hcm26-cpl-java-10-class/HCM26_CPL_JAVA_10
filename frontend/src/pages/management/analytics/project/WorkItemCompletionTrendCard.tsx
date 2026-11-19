import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProjectAnalyticsCompletionSeriesKey,
  ProjectAnalyticsCompletionTrend,
  ProjectAnalyticsDrillDownTarget,
} from "@/types/features/project-analytics";
import { LegendToggleButton, StackedBarTooltip } from "./analytics-chart-ui";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-007 legend: Blue = Subtask, Green = Story, Purple = Task (when Task items exist). */
const SUBTASK_COLOR = "#2563EB";
const STORY_COLOR = "#7CB342";
const TASK_COLOR = "#A855F7";

/**
 * US-ANL-007 / US-ANL-008: "Work item completion trend" stacked bar chart with
 * interactive percentage tooltips, legend series toggling with Y-axis rescaling,
 * and click-to-drill-down on stacked segments.
 */
export function WorkItemCompletionTrendCard({
  trend,
  onDrillDown,
}: {
  trend: ProjectAnalyticsCompletionTrend;
  onDrillDown?: (target: ProjectAnalyticsDrillDownTarget) => void;
}) {
  const [visible, setVisible] = useState<Record<ProjectAnalyticsCompletionSeriesKey, boolean>>({
    subtask: true,
    story: true,
    task: true,
  });
  const rows = trend?.buckets ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";
  const hasTasks = rows.some(row => row.task > 0) || Boolean(trend?.series?.some(item => item.key === "task"));
  const showTask = hasTasks && visible.task;
  const allHidden = !visible.subtask && !visible.story && !showTask;

  const toggle = (key: ProjectAnalyticsCompletionSeriesKey) => {
    setVisible(current => ({ ...current, [key]: !current[key] }));
  };

  // US-ANL-008 AC02: rescale Y-axis to the stacked max of currently visible series.
  const maxVisibleTotal = rows.reduce((max, row) => {
    const sum = (visible.subtask ? row.subtask : 0)
      + (visible.story ? row.story : 0)
      + (showTask ? row.task : 0);
    return sum > max ? sum : max;
  }, 0);
  const yDomainMax = maxVisibleTotal <= 0 ? 1 : maxVisibleTotal;

  const topVisibleKey: ProjectAnalyticsCompletionSeriesKey | null = showTask
    ? "task"
    : visible.story
      ? "story"
      : visible.subtask
        ? "subtask"
        : null;

  const handleBarClick = (
    series: ProjectAnalyticsCompletionSeriesKey,
    barData: { payload?: { date?: string } },
  ) => {
    const date = barData?.payload?.date;
    if (date && onDrillDown) {
      onDrillDown({ chart: "completion", date, series });
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
            <CheckCircle2 className="size-3.5" strokeWidth={2} />
          </span>
          <CardTitle className="truncate text-[13px] font-semibold tracking-tight">
            Work item completion trend
          </CardTitle>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LegendToggleButton
            color={SUBTASK_COLOR}
            label="Subtask"
            shape="square"
            visible={visible.subtask}
            onToggle={() => toggle("subtask")}
          />
          <LegendToggleButton
            color={STORY_COLOR}
            label="Story"
            shape="square"
            visible={visible.story}
            onToggle={() => toggle("story")}
          />
          {hasTasks && (
            <LegendToggleButton
              color={TASK_COLOR}
              label="Task"
              shape="square"
              visible={visible.task}
              onToggle={() => toggle("task")}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        <div className="relative h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 24, left: 0 }} barCategoryGap="24%">
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
                allowDecimals={false}
                domain={[0, yDomainMax]}
                width={58}
                tick={{ fontSize: 10, fill: AXIS_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
              >
                <Label
                  value="Count of work items"
                  angle={-90}
                  position="insideLeft"
                  offset={8}
                  style={{ fontSize: 10, fill: AXIS_COLOR, textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                content={({ active, label, payload }) => (
                  <StackedBarTooltip active={active} label={label} payload={payload} />
                )}
              />
              {visible.subtask && (
                <Bar
                  dataKey="subtask"
                  name="Subtask"
                  stackId="completion"
                  fill={SUBTASK_COLOR}
                  radius={topVisibleKey === "subtask" ? [4, 4, 0, 0] : undefined}
                  maxBarSize={36}
                  className={onDrillDown ? "cursor-pointer" : undefined}
                  onClick={barData => handleBarClick("subtask", barData)}
                />
              )}
              {visible.story && (
                <Bar
                  dataKey="story"
                  name="Story"
                  stackId="completion"
                  fill={STORY_COLOR}
                  radius={topVisibleKey === "story" ? [4, 4, 0, 0] : undefined}
                  maxBarSize={36}
                  className={onDrillDown ? "cursor-pointer" : undefined}
                  onClick={barData => handleBarClick("story", barData)}
                />
              )}
              {showTask && (
                <Bar
                  dataKey="task"
                  name="Task"
                  stackId="completion"
                  fill={TASK_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  className={onDrillDown ? "cursor-pointer" : undefined}
                  onClick={barData => handleBarClick("task", barData)}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
          {(empty || allHidden) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">
                {empty ? "No work items completed in this window" : "All series hidden — click a legend item to show"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
