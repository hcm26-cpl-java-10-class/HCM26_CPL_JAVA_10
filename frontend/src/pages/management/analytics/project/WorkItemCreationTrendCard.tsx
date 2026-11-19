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
import type { ProjectAnalyticsCreationTrend } from "@/types/features/project-analytics";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-004 legend: blue = Done, green = To Do. */
const DONE_COLOR = "#2563EB";
const TODO_COLOR = "#7CB342";

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 11, borderRadius: 8, borderColor: GRID_COLOR },
  labelStyle: { fontSize: 11, fontWeight: 600 },
} as const;

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/**
 * US-ANL-004: "Work item creation trend" stacked bar chart.
 *
 * Every bar is one creation date (X axis, `YYYY-MM-DD`). The blue bottom
 * segment is the number of items created that day that are Done, the green cap
 * is the number that is still open (To do, In progress, Review, Blocked), so
 * the bar total is the daily creation count. The backend only sends the dates
 * that actually received a work item, already ordered oldest first, and the
 * integer Y axis starts at 0 (AC01 / AC02).
 */
export function WorkItemCreationTrendCard({ trend }: { trend: ProjectAnalyticsCreationTrend }) {
  const rows = trend.buckets;
  const empty = rows.length === 0 || trend.state === "EMPTY";

  return (
    <Card className="gap-0 rounded-xl py-0 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
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
        <div className="flex shrink-0 items-center gap-3">
          <LegendSwatch color={DONE_COLOR} label="Done" />
          <LegendSwatch color={TODO_COLOR} label="To Do" />
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
                  value="Work item creation date"
                  position="insideBottom"
                  offset={-16}
                  style={{ fontSize: 10, fill: AXIS_COLOR }}
                />
              </XAxis>
              <YAxis
                allowDecimals={false}
                domain={[0, (dataMax: number) => (dataMax <= 0 ? 1 : dataMax)]}
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
                {...TOOLTIP_STYLE}
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                labelFormatter={value => String(value)}
              />
              {/* AC01: Done is the bottom blue segment, To Do stacks on top. */}
              <Bar dataKey="done" name="Done" stackId="creation" fill={DONE_COLOR} maxBarSize={36} />
              <Bar
                dataKey="todo"
                name="To Do"
                stackId="creation"
                fill={TODO_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[10px] text-muted-foreground">No items created in this window</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
