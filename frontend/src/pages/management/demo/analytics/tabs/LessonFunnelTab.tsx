import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  formatPercent,
  tooltipNumber,
  tooltipPercent,
  truncateLabel,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { LessonFunnelItem } from "@/types";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

type ChartRow = {
  name: string;
  position: number;
  completionRate: number;
  startedCount: number;
  completedCount: number;
  dropOffFromPrevious: number;
  sectionTitle: string;
};

export function LessonFunnelTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "lesson-funnel", courseId],
    queryFn: () => courseAnalyticsApi.getLessonFunnel(courseId),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading the learning funnel..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the learning funnel data. Check your access to this course."
      />
    );
  }

  if (!data.lessons.length) {
    return (
      <AnalyticsEmptyState message="This course has no active lessons yet, so there is no funnel data."
      />
    );
  }

  const chartData: ChartRow[] = data.lessons.map((lesson) => ({
    name: truncateLabel(lesson.lessonTitle, 14),
    position: lesson.position,
    completionRate: lesson.completionRate,
    startedCount: lesson.startedCount,
    completedCount: lesson.completedCount,
    dropOffFromPrevious: lesson.dropOffFromPrevious,
    sectionTitle: lesson.sectionTitle,
  }));

  const worst = data.biggestDropOff;
  const lowest = data.lowestCompletion;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the learning funnel."
          onExport={() => courseAnalyticsApi.exportLessonFunnel(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active learners" value={formatNumber(data.totalLearners)} />
        <MetricCard label="Lessons" value={formatNumber(data.totalLessons)} />
        <MetricCard
          label="Biggest drop-off"
          value={worst ? formatPercent(worst.dropOffFromPrevious) : "—"}
          hint={worst ? worst.lessonTitle : "No drop-off data"}
          tone={worst && worst.dropOffFromPrevious > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Lowest completion"
          value={lowest ? formatPercent(lowest.completionRate) : "—"}
          hint={lowest ? lowest.lessonTitle : "No data"}
          tone={lowest && lowest.completionRate < 50 ? "warning" : "default"}
        />
      </div>

      <AnalyticsPanel
        title="Completion rate by lesson order"
        description="The line shows the % of learners who completed each lesson. A steep drop means many learners abandoned that lesson."
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 60, left: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                unit="%"
                domain={[0, 100]}
                width={45}
              />
              <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                formatter={(value, name) =>
                  name === "completionRate"
                    ? tooltipPercent(value, "Completion")
                    : tooltipNumber(value, String(name))
                }
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  return row ? `${row.position}. ${row.sectionTitle}` : "";
                }}
              />
              <Line isAnimationActive={true} animationDuration={850} animationEasing="ease-out"
                type="monotone"
                dataKey="completionRate"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Drop-off between lessons"
        description="Red bars show the % drop compared with the previous lesson. The taller the bar, the more the lesson content should be reviewed."
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 60, left: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} unit="%" width={45} />
              <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                formatter={(value) => tooltipPercent(value, "Drop-off")}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  return row ? `${row.position}. ${row.sectionTitle}` : "";
                }}
              />
              <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="dropOffFromPrevious" radius={[4, 4, 0, 0]}>
                {chartData.map((row) => (
                  <Cell
                    key={row.position}
                    fill={row.dropOffFromPrevious > 0 ? CHART_COLORS[3] : GRID_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Lesson details"
        description="Number of learners who started / completed each lesson and the drop-off for every lesson in the course."
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Lesson</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Started</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Drop-off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lessons.map((lesson) => (
                <FunnelRow key={lesson.lessonId} lesson={lesson} />
              ))}
            </TableBody>
          </Table>
        </div>
      </AnalyticsPanel>
    </div>
  );
}

function FunnelRow({ lesson }: { lesson: LessonFunnelItem }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{lesson.position}</TableCell>
      <TableCell className="font-medium">{lesson.lessonTitle}</TableCell>
      <TableCell className="text-muted-foreground">{lesson.sectionTitle}</TableCell>
      <TableCell className="text-right">{formatNumber(lesson.startedCount)}</TableCell>
      <TableCell className="text-right">{formatNumber(lesson.completedCount)}</TableCell>
      <TableCell className="text-right">{formatPercent(lesson.completionRate)}</TableCell>
      <TableCell className="text-right">
        {lesson.dropOffFromPrevious > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-destructive">
            <TrendingDown className="size-3.5" />
            {formatPercent(lesson.dropOffFromPrevious)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}