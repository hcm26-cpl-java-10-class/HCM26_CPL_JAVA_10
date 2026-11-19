import { useState } from "react";
import { Timer } from "lucide-react";
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
  ProjectAnalyticsCycleTimeTrend,
  ProjectAnalyticsDrillDownTarget,
} from "@/types/features/project-analytics";
import {
  ChartSkeleton,
  LegendToggleButton,
  MetricLineTooltip,
  WidgetInlineError,
} from "./analytics-chart-ui";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-005: single blue line with circular node markers. */
const LINE_COLOR = "#2563EB";

/**
 * US-ANL-005 / US-ANL-008: "Work item cycle time" line chart with hover
 * tooltip, toggleable legend, and click-to-drill-down on any completion-date
 * node (AC03).
 */
export function WorkItemCycleTimeCard({
  trend,
  onDrillDown,
  isLoading = false,
  errorMessage,
  onRetry,
  retrying = false,
}: {
  trend?: ProjectAnalyticsCycleTimeTrend;
  onDrillDown?: (target: ProjectAnalyticsDrillDownTarget) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const rows = trend?.points ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";

  const maxVisibleDays = visible
    ? rows.reduce((max, row) => (row.averageDays > max ? row.averageDays : max), 0)
    : 0;
  const yDomainMax = maxVisibleDays <= 0 ? 1 : Math.ceil(maxVisibleDays);

  const openDate = (date?: string) => {
    if (date && onDrillDown) {
      onDrillDown({ chart: "cycle-time", date });
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
            <Timer className="size-3.5" strokeWidth={2} />
          </span>
          <CardTitle className="truncate text-[13px] font-semibold tracking-tight">
            Work item cycle time
          </CardTitle>
        </div>
        <LegendToggleButton
          color={LINE_COLOR}
          label="Avg cycle time"
          shape="dot"
          visible={visible}
          onToggle={() => setVisible(current => !current)}
        />
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
                if (visible && state?.activeLabel != null) {
                  openDate(String(state.activeLabel));
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
                  value="Average work item cycle time (days)"
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
                    countResolver={entry => (entry.payload as { itemCount?: number } | undefined)?.itemCount}
                  />
                )}
              />
              {visible && (
                <Line
                  type="linear"
                  dataKey="averageDays"
                  name="Avg cycle time"
                  stroke={LINE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 1.5 }}
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
                        fill={LINE_COLOR}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className={onDrillDown ? "cursor-pointer" : undefined}
                        onClick={event => {
                          event.stopPropagation();
                          openDate(pointDate);
                        }}
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          {(empty || !visible) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">
                {empty ? "No work items completed in this window" : "Series hidden — click the legend item to show"}
              </p>
            </div>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
