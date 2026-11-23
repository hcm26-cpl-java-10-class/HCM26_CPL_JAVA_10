import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { MetricCard } from "@/pages/management/demo/analytics/components/MetricCard";
import {
  AXIS_COLOR,
  CHART_COLORS,
  GRID_COLOR,
  formatNumber,
  formatPercent,
  tooltipNumber,
  truncateLabel,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { BottleneckReason, LessonBottleneckItem } from "@/types";

type Props = {
  courseId: number;
  /** Learners inactive for at least this many days (and not finished) count as dropped out. */
  inactiveDays?: number;
};

const REASON_LABEL: Record<BottleneckReason, string> = {
  HIGH_DROP_OFF: "Steep drop-off",
  HIGH_DROPOUT: "Learners quit here",
  MANY_STUCK: "Many stuck",
  SLOW_COMPLETION: "Takes too long",
  REPORTED: "Reported issue",
};

const formatMinutes = (seconds: number) =>
  seconds > 0 ? `${Math.max(1, Math.round(seconds / 60))} min` : "—";

/** Where learners drop out and which lessons are bottlenecks. */
export function BottleneckPanel({ courseId, inactiveDays = 14 }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "bottlenecks", courseId, inactiveDays],
    queryFn: () => courseAnalyticsApi.getBottlenecks(courseId, { inactiveDays }),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Analysing bottlenecks..." />;
  }
  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the bottleneck data."
      />
    );
  }
  if (!data.lessons.length) {
    return null;
  }

  const chartData = data.lessons.map((lesson) => ({
    name: truncateLabel(lesson.lessonTitle, 14),
    position: lesson.position,
    sectionTitle: lesson.sectionTitle,
    dropoutCount: lesson.dropoutCount,
    stuckCount: lesson.stuckCount,
  }));
  const top = data.topDropoutLesson;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Dropped out"
          value={formatNumber(data.droppedLearners)}
          hint={`Not finished and inactive for ${data.inactiveThresholdDays}+ days`}
          tone={data.droppedLearners > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Quit before lesson 1"
          value={formatNumber(data.neverStartedDropouts)}
          hint="Enrolled but never opened a lesson"
          tone={data.neverStartedDropouts > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Most common quit point"
          value={top ? `#${top.position}` : "—"}
          hint={
            top
              ? `${top.lessonTitle} (${formatNumber(top.dropoutCount)} learners)`
              : "No one has dropped out yet"
          }
          tone={top ? "danger" : "default"}
        />
        <MetricCard
          label="Bottleneck lessons"
          value={formatNumber(data.bottlenecks.length)}
          hint="Lessons flagged by drop-off, stuck learners, time or reports"
          tone={data.bottlenecks.length > 0 ? "warning" : "default"}
        />
      </div>

      <AnalyticsPanel
        title="Where do learners drop out?"
        description="Red = inactive learners whose last lesson was this one. Amber = learners who opened the lesson but have not completed it."
      >
        <div className="h-72 w-full">
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
              <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
              <Tooltip
                shared={false}
                cursor={false}
                wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                formatter={(value, name) => tooltipNumber(value, String(name))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | { position: number; sectionTitle: string }
                    | undefined;
                  return row ? `${row.position}. ${row.sectionTitle}` : "";
                }}
              />
              <Legend />
              <Bar
                dataKey="dropoutCount"
                name="Dropped out here"
                fill={CHART_COLORS[3]}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="stuckCount"
                name="Started, not completed"
                fill={CHART_COLORS[2]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Bottleneck lessons"
        description="Ranked by a score combining drop-off from the previous lesson, learners quitting, learners stuck, time spent versus the planned duration and reports."
      >
        {!data.bottlenecks.length ? (
          <AnalyticsEmptyState message="No bottleneck detected. Learners are moving through the course smoothly." />
        ) : (
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Lesson</TableHead>
                  <TableHead className="text-right">Dropped out</TableHead>
                  <TableHead className="text-right">Stuck</TableHead>
                  <TableHead className="text-right">Drop-off</TableHead>
                  <TableHead className="text-right">Avg time</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bottlenecks.map((lesson) => (
                  <BottleneckRow key={lesson.lessonId} lesson={lesson} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AnalyticsPanel>

      {data.sections.length > 1 ? (
        <AnalyticsPanel
          title="By section"
          description="Average completion and dropout per section."
        >
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Lessons</TableHead>
                  <TableHead className="text-right">Avg completion</TableHead>
                  <TableHead className="text-right">Dropped out</TableHead>
                  <TableHead className="text-right">Dropout rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sections.map((section) => (
                  <TableRow key={section.sectionId}>
                    <TableCell className="font-medium">{section.sectionTitle}</TableCell>
                    <TableCell className="text-right">{formatNumber(section.lessonCount)}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(section.averageCompletionRate)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(section.dropoutCount)}</TableCell>
                    <TableCell className="text-right">{formatPercent(section.dropoutRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AnalyticsPanel>
      ) : null}
    </div>
  );
}

function BottleneckRow({ lesson }: { lesson: LessonBottleneckItem }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{lesson.position}</TableCell>
      <TableCell>
        <div className="font-medium">{lesson.lessonTitle}</div>
        <div className="text-xs text-muted-foreground">{lesson.sectionTitle}</div>
      </TableCell>
      <TableCell className="text-right">
        {formatNumber(lesson.dropoutCount)}
        <span className="ml-1 text-xs text-muted-foreground">
          ({formatPercent(lesson.dropoutRate, 0)})
        </span>
      </TableCell>
      <TableCell className="text-right">
        {formatNumber(lesson.stuckCount)}
        <span className="ml-1 text-xs text-muted-foreground">
          ({formatPercent(lesson.stuckRate, 0)})
        </span>
      </TableCell>
      <TableCell className="text-right">
        {lesson.dropOffFromPrevious > 0 ? formatPercent(lesson.dropOffFromPrevious) : "—"}
      </TableCell>
      <TableCell className="text-right">
        {formatMinutes(lesson.avgStudySeconds)}
        {lesson.expectedSeconds > 0 ? (
          <span className="ml-1 text-xs text-muted-foreground">
            / {formatMinutes(lesson.expectedSeconds)}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {lesson.reasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {REASON_LABEL[reason] ?? reason}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Badge variant={lesson.severity === "HIGH" ? "destructive" : "secondary"}>
          {lesson.bottleneckScore}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
