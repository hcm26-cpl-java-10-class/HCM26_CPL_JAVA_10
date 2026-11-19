import { useState } from "react";
import { BarChart3 } from "lucide-react";
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
  ProjectAnalyticsCreationTrend,
  ProjectAnalyticsDrillDownTarget,
} from "@/types/features/project-analytics";
import {
  ChartSkeleton,
  LegendToggleButton,
  StackedBarTooltip,
  WidgetInlineError,
} from "./analytics-chart-ui";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-004 legend: blue = Done, green = To Do. */
const DONE_COLOR = "#2563EB";
const TODO_COLOR = "#7CB342";

/**
 * US-ANL-004 / US-ANL-008: "Work item creation trend" stacked bar chart with
 * interactive percentage tooltips, legend toggling with Y-axis rescaling, and
 * click-to-drill-down on bar segments.
 */
export function WorkItemCreationTrendCard({
  trend,
  onDrillDown,
  isLoading = false,
  errorMessage,
  onRetry,
  retrying = false,
}: {
  trend?: ProjectAnalyticsCreationTrend;
  onDrillDown?: (target: ProjectAnalyticsDrillDownTarget) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [visible, setVisible] = useState({ done: true, todo: true });
  const rows = trend?.buckets ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";
  const allHidden = !visible.done && !visible.todo;

  const toggle = (key: "done" | "todo") => {
    setVisible(current => ({ ...current, [key]: !current[key] }));
  };

  // US-ANL-008 AC02: rescale Y-axis to the stacked max of currently visible series.
  const maxVisibleTotal = rows.reduce((max, row) => {
    const sum = (visible.done ? row.done : 0) + (visible.todo ? row.todo : 0);
    return sum > max ? sum : max;
  }, 0);
  const yDomainMax = maxVisibleTotal <= 0 ? 1 : maxVisibleTotal;

  const handleBarClick = (series: "done" | "todo", barData: { payload?: { date?: string } }) => {
    const date = barData?.payload?.date;
    if (date && onDrillDown) {
      onDrillDown({ chart: "creation", date, series });
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
            <BarChart3 className="size-3.5" strokeWidth={2} />
          </span>
          <CardTitle className="truncate text-[13px] font-semibold tracking-tight">
            Work item creation trend
          </CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LegendToggleButton
            color={DONE_COLOR}
            label="Done"
            shape="square"
            visible={visible.done}
            onToggle={() => toggle("done")}
          />
          <LegendToggleButton
            color={TODO_COLOR}
            label="To Do"
            shape="square"
            visible={visible.todo}
            onToggle={() => toggle("todo")}
          />
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        {isLoading ? (
          <ChartSkeleton variant="bar" />
        ) : errorMessage ? (
          <div className="p-2">
            <WidgetInlineError message={errorMessage} onRetry={onRetry} retrying={retrying} className="h-[204px]" />
          </div>
        ) : (
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
                  value="Work item creation date"
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
              {/* AC01: Done is the bottom blue segment, To Do stacks on top. */}
              {visible.done && (
                <Bar
                  dataKey="done"
                  name="Done"
                  stackId="creation"
                  fill={DONE_COLOR}
                  radius={visible.todo ? undefined : [4, 4, 0, 0]}
                  maxBarSize={36}
                  className={onDrillDown ? "cursor-pointer" : undefined}
                  onClick={barData => handleBarClick("done", barData)}
                />
              )}
              {visible.todo && (
                <Bar
                  dataKey="todo"
                  name="To Do"
                  stackId="creation"
                  fill={TODO_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  className={onDrillDown ? "cursor-pointer" : undefined}
                  onClick={barData => handleBarClick("todo", barData)}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
          {(empty || allHidden) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">
                {empty ? "No items created in this window" : "All series hidden — click a legend item to show"}
              </p>
            </div>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
