import { useQuery } from "@tanstack/react-query";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  formatDateTime,
  formatNumber,
  formatPercent,
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

/** English labels for the report reason codes. */
const REASON_LABELS: Record<string, string> = {
  BROKEN_CONTENT: "Broken content",
  INCORRECT_CONTENT: "Incorrect content",
  OUTDATED_CONTENT: "Outdated content",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  OTHER: "Other reason",
};

const reasonLabel = (reason?: string | null) =>
  (reason && REASON_LABELS[reason]) || reason || "—";

export function ContentQualityQnATab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "content-quality", courseId],
    queryFn: () => courseAnalyticsApi.getContentQuality(courseId),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading content quality data..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the content quality data."
      />
    );
  }

  const hasData =
    data.totalReports > 0 ||
    data.totalQuestions > 0 ||
    data.mostReportedLessons.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-end">
          <ExportExcelButton
            label="Export Excel"
            successMessage="Exported the content quality data."
            onExport={() => courseAnalyticsApi.exportContentQuality(courseId)}
          />
        </div>
        <AnalyticsEmptyState message="This course has no lesson reports or questions yet." />
      </div>
    );
  }

  const reasonChart = data.reportReasons.map((bucket) => ({
    ...bucket,
    label: reasonLabel(bucket.reason),
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the content quality data."
          onExport={() => courseAnalyticsApi.exportContentQuality(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reported lessons"
          value={formatNumber(data.totalReports)}
          hint={`${formatNumber(data.openReports)} open · ${formatNumber(data.resolvedReports)} resolved`}
          tone={data.openReports > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Unanswered questions"
          value={formatNumber(data.unansweredCount)}
          hint={`${formatNumber(data.totalQuestions)} questions in total`}
          tone={data.unansweredCount > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Answer rate"
          value={formatPercent(data.answerRate)}
          hint={`${formatNumber(data.answeredQuestions)} questions answered`}
        />
        <MetricCard
          label="Average response time"
          value={
            data.averageResponseHours == null
              ? "—"
              : `${formatNumber(data.averageResponseHours)} h`
          }
          hint="Measured from the question to the first answer"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Most reported lessons"
          description="Top lessons with the highest number of reports in this course."
        >
          {!data.mostReportedLessons.length ? (
            <AnalyticsEmptyState message="No reports for this course yet." />
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Lesson</TableHead>
                    <TableHead>Top reason</TableHead>
                    <TableHead className="text-right">Reports</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mostReportedLessons.map((item) => (
                    <TableRow key={item.lessonId}>
                      <TableCell className="font-medium text-muted-foreground">
                        {item.rank}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.lessonTitle}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {reasonLabel(item.topReason)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.reportCount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.openReports)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Reports by reason"
          description="Number of reports grouped by the reason learners gave."
        >
          {!reasonChart.length ? (
            <AnalyticsEmptyState message="No reports for this course yet." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reasonChart}
                  margin={{ top: 10, right: 20, bottom: 40, left: 0 }}
                >
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
                  <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }} formatter={(value) => tooltipNumber(value, "Reports")} />
                  <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="count" radius={[4, 4, 0, 0]}>
                    {reasonChart.map((item, index) => (
                      <Cell
                        key={item.reason}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Unanswered questions"
        description="Questions from learners still waiting for a response, newest first."
      >
        {!data.unansweredQuestions.length ? (
          <AnalyticsEmptyState message="All questions have been answered." />
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lesson</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Asked</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unansweredQuestions.map((item) => (
                  <TableRow key={item.questionId}>
                    <TableCell className="font-medium">{item.lessonTitle || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.studentName || "—"}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate" title={item.content}>
                        {item.content}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.waitingHours > 72
                            ? "font-medium text-destructive"
                            : "font-medium"
                        }
                      >
                        {formatNumber(item.waitingHours)} h
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AnalyticsPanel>
    </div>
  );
}