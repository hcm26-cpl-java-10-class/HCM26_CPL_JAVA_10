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
import type { ProjectAnalyticsCycleTimeTrend } from "@/types/features/project-analytics";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-005: single blue line with circular node markers. */
const LINE_COLOR = "#2563EB";

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 11, borderRadius: 8, borderColor: GRID_COLOR },
  labelStyle: { fontSize: 11, fontWeight: 600 },
} as const;

/**
 * US-ANL-005: "Work item cycle time" line chart.
 *
 * Each point is one completion date (X axis, `YYYY-MM-DD`, tenant time zone)
 * and the average active execution time in days of the items completed that
 * day (first In progress → final Done). Open items are never plotted, and the
 * backend sends the points oldest first so the line connects them
 * chronologically (AC01 / AC03).
 */
export function WorkItemCycleTimeCard({ trend }: { trend: ProjectAnalyticsCycleTimeTrend }) {
  const rows = trend?.points ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";

  return (
    <Card className="gap-0 rounded-xl py-0 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
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
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
          Avg cycle time
        </span>
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
                domain={[0, (dataMax: number) => (dataMax <= 0 ? 1 : Math.ceil(dataMax))]}
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
                {...TOOLTIP_STYLE}
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                labelFormatter={value => String(value)}
                formatter={(value, _name, item) => {
                  const count = (item?.payload as { itemCount?: number } | undefined)?.itemCount ?? 0;
                  return [
                    `${Number(value).toFixed(1)} days (${count} item${count === 1 ? "" : "s"})`,
                    "Avg cycle time",
                  ];
                }}
              />
              <Line
                type="linear"
                dataKey="averageDays"
                name="Avg cycle time"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 3.5, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
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
