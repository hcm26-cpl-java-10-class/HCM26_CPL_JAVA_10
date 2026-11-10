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

type Props = {
  courseId: number;
};

/** Nhãn tiếng Việt cho mã lý do báo cáo. */
const REASON_LABELS: Record<string, string> = {
  BROKEN_CONTENT: "Nội dung hỏng",
  INCORRECT_CONTENT: "Nội dung sai",
  OUTDATED_CONTENT: "Nội dung lỗi thời",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  OTHER: "Lý do khác",
};

const reasonLabel = (reason?: string | null) =>
  (reason && REASON_LABELS[reason]) || reason || "—";

export function ContentQualityQnATab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "content-quality", courseId],
    queryFn: () => courseAnalyticsApi.getContentQuality(courseId),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Đang tải dữ liệu chất lượng nội dung...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu chất lượng nội dung."
      />
    );
  }

  const hasData =
    data.totalReports > 0 ||
    data.totalQuestions > 0 ||
    data.mostReportedLessons.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end">
          <ExportExcelButton
            label="Export Excel"
            successMessage="Đã export dữ liệu chất lượng nội dung."
            onExport={() => courseAnalyticsApi.exportContentQuality(courseId)}
          />
        </div>
        <AnalyticsEmptyState message="Khóa học chưa có báo lỗi bài học hay câu hỏi nào." />
      </div>
    );
  }

  const reasonChart = data.reportReasons.map((bucket) => ({
    ...bucket,
    label: reasonLabel(bucket.reason),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Đã export dữ liệu chất lượng nội dung."
          onExport={() => courseAnalyticsApi.exportContentQuality(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Bài học bị báo lỗi"
          value={formatNumber(data.totalReports)}
          hint={`${formatNumber(data.openReports)} đang mở · ${formatNumber(data.resolvedReports)} đã xử lý`}
          tone={data.openReports > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Câu hỏi chưa trả lời"
          value={formatNumber(data.unansweredCount)}
          hint={`${formatNumber(data.totalQuestions)} câu hỏi trong tổng số`}
          tone={data.unansweredCount > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Tỷ lệ đã trả lời"
          value={formatPercent(data.answerRate)}
          hint={`${formatNumber(data.answeredQuestions)} câu đã có câu trả lời`}
        />
        <MetricCard
          label="Thời gian phản hồi TB"
          value={
            data.averageResponseHours == null
              ? "—"
              : `${formatNumber(data.averageResponseHours)} giờ`
          }
          hint="Tính từ lúc hỏi đến câu trả lời đầu tiên"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Bài học bị báo lỗi nhiều nhất"
          description="Top bài học có nhiều lượt báo cáo nhất trong khóa học."
        >
          {!data.mostReportedLessons.length ? (
            <AnalyticsEmptyState message="Chưa có báo cáo nào cho khóa học này." />
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Bài học</TableHead>
                    <TableHead>Lý do chính</TableHead>
                    <TableHead className="text-right">Báo cáo</TableHead>
                    <TableHead className="text-right">Đang mở</TableHead>
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
          title="Phân loại báo cáo theo lý do"
          description="Số lượt báo cáo được nhóm theo lý do học viên gửi."
        >
          {!reasonChart.length ? (
            <AnalyticsEmptyState message="Chưa có báo cáo nào cho khóa học này." />
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
                  <Tooltip formatter={(value) => tooltipNumber(value, "Báo cáo")} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
        title="Câu hỏi chưa được trả lời"
        description="Câu hỏi của học viên đang chờ giảng viên phản hồi, sắp xếp mới nhất trước."
      >
        {!data.unansweredQuestions.length ? (
          <AnalyticsEmptyState message="Tất cả câu hỏi đều đã được trả lời." />
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bài học</TableHead>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Nội dung câu hỏi</TableHead>
                  <TableHead>Ngày hỏi</TableHead>
                  <TableHead className="text-right">Đã chờ</TableHead>
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
                        {formatNumber(item.waitingHours)} giờ
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
