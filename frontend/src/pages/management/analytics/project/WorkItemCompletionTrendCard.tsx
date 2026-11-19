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
import type { ProjectAnalyticsCompletionTrend } from "@/types/features/project-analytics";

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e8edf3";

/** US-ANL-007 legend: Blue = Subtask, Green = Story, Purple = Task (when Task items exist). */
const SUBTASK_COLOR = "#2563EB";
const STORY_COLOR = "#7CB342";
const TASK_COLOR = "#A855F7";

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
 * US-ANL-007: "Work item completion trend" stacked bar chart.
 *
 * Every bar is one completion date (X axis, `YYYY-MM-DD`, tenant time zone)
 * stacked into Blue (`Subtask`), Green (`Story`), and Purple (`Task` when Task
 * completions exist). Reopened items are excluded (AC03), and with no date
 * restriction the sum across all bars reconciles with the `Done` total of the
 * creation trend chart (AC01 / AC02).
 */
export function WorkItemCompletionTrendCard({ trend }: { trend: ProjectAnalyticsCompletionTrend }) {
  const rows = trend?.buckets ?? [];
  const empty = rows.length === 0 || trend?.state === "EMPTY";
  const hasTasks = rows.some(row => row.task > 0) || Boolean(trend?.series?.some(item => item.key === "task"));

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
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <LegendSwatch color={SUBTASK_COLOR} label="Subtask" />
          <LegendSwatch color={STORY_COLOR} label="Story" />
          {hasTasks && <LegendSwatch color={TASK_COLOR} label="Task" />}
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
                domain={[0, (dataMax: number) => (!Number.isFinite(dataMax) || dataMax <= 0 ? 1 : dataMax)]}
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
              <Bar
                dataKey="subtask"
                name="Subtask"
                stackId="completion"
                fill={SUBTASK_COLOR}
                maxBarSize={36}
              />
              <Bar
                dataKey="story"
                name="Story"
                stackId="completion"
                fill={STORY_COLOR}
                radius={hasTasks ? undefined : [4, 4, 0, 0]}
                maxBarSize={36}
              />
              {hasTasks && (
                <Bar
                  dataKey="task"
                  name="Task"
                  stackId="completion"
                  fill={TASK_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              )}
            </BarChart>
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
