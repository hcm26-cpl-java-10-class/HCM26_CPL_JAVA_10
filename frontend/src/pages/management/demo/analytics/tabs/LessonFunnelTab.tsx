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
    return <p className="text-sm text-muted-foreground">Đang tải phễu học tập...</p>;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu phễu học tập. Kiểm tra quyền truy cập khóa học."
      />
    );
  }

  if (!data.lessons.length) {
    return (
      <AnalyticsEmptyState message="Khóa học chưa có bài học (lesson) nào đang hoạt động nên chưa có dữ liệu phễu."
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
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Đã export phễu học tập."
          onExport={() => courseAnalyticsApi.exportLessonFunnel(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Học viên đang học" value={formatNumber(data.totalLearners)} />
        <MetricCard label="Số bài học" value={formatNumber(data.totalLessons)} />
        <MetricCard
          label="Bài tụt mạnh nhất"
          value={worst ? formatPercent(worst.dropOffFromPrevious) : "—"}
          hint={worst ? worst.lessonTitle : "Không có dữ liệu tụt"}
          tone={worst && worst.dropOffFromPrevious > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Bài hoàn thành thấp nhất"
          value={lowest ? formatPercent(lowest.completionRate) : "—"}
          hint={lowest ? lowest.lessonTitle : "Không có dữ liệu"}
          tone={lowest && lowest.completionRate < 50 ? "warning" : "default"}
        />
      </div>

      <AnalyticsPanel
        title="Tỉ lệ hoàn thành theo thứ tự bài"
        description="Đường thể hiện % học viên hoàn thành từng bài. Bài nào đường rơi mạnh là bài học viên bỏ dở nhiều nhất."
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
              <Tooltip
                formatter={(value, name) =>
                  name === "completionRate"
                    ? tooltipPercent(value, "Hoàn thành")
                    : tooltipNumber(value, String(name))
                }
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  return row ? `${row.position}. ${row.sectionTitle}` : "";
                }}
              />
              <Line
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
        title="Mức tụt giữa các bài (drop-off)"
        description="Cột đỏ = điểm % tụt so với bài liền trước. Cột càng cao càng nên xem lại nội dung."
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
              <Tooltip
                formatter={(value) => tooltipPercent(value, "Tụt")}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  return row ? `${row.position}. ${row.sectionTitle}` : "";
                }}
              />
              <Bar dataKey="dropOffFromPrevious" radius={[4, 4, 0, 0]}>
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
        title="Chi tiết từng bài"
        description="Số học viên đã bắt đầu / đã hoàn thành và mức tụt của từng bài trong khóa."
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Bài học</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Đã bắt đầu</TableHead>
                <TableHead className="text-right">Đã hoàn thành</TableHead>
                <TableHead className="text-right">Tỉ lệ</TableHead>
                <TableHead className="text-right">Tụt</TableHead>
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
