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
  formatNumber,
  formatPercent,
  tooltipNumber,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { ExamAnalyticsItem } from "@/types";

type Props = {
  courseId: number;
};

export function ExamAnalyticsTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "exam-analytics", courseId],
    queryFn: () => courseAnalyticsApi.getExamAnalytics(courseId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải kết quả bài thi...</p>;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu kết quả bài thi của khóa học."
      />
    );
  }

  if (!data.exams.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end">
          <ExportExcelButton
            label="Export Excel"
            successMessage="Đã export dữ liệu bài thi."
            onExport={() => courseAnalyticsApi.exportExams(courseId)}
          />
        </div>
        <AnalyticsEmptyState message="Khóa học chưa có bài thi nào đang hoạt động (exam) được liên kết." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Đã export dữ liệu bài thi."
          onExport={() => courseAnalyticsApi.exportExams(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Số bài thi" value={formatNumber(data.totalExams)} />
        <MetricCard
          label="Lượt đã chấm"
          value={formatNumber(data.totalGradedAttempts)}
          hint="Lượt có điểm và đã nộp/hết hạn"
        />
        <MetricCard
          label="Điểm trung bình"
          value={
            data.overallAverageScorePercent == null
              ? "—"
              : formatPercent(data.overallAverageScorePercent)
          }
          hint="Theo % điểm tối đa"
        />
        <MetricCard
          label="Tỉ lệ đạt"
          value={
            data.overallPassRate == null ? "—" : formatPercent(data.overallPassRate)
          }
          hint="Đạt ngưỡng điểm của từng bài thi"
          tone={data.overallPassRate != null && data.overallPassRate < 50 ? "warning" : "default"}
        />
      </div>

      <AnalyticsPanel
        title="Phân bố điểm toàn khóa"
        description="Tổng số lượt thi đã chấm theo khoảng % điểm tối đa (0-20, 20-40, ...)."
      >
        <OverallDistribution exams={data.exams} />
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Chi tiết từng bài thi"
        description="Điểm trung bình, tỉ lệ đạt và phân bố điểm của mỗi bài thi thuộc khóa."
      >
        <div className="space-y-4">
          {data.exams.map((exam) => (
            <ExamRow key={exam.examId} exam={exam} />
          ))}
        </div>
      </AnalyticsPanel>
    </div>
  );
}

function OverallDistribution({ exams }: { exams: ExamAnalyticsItem[] }) {
  const labels = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];

  const merged = labels.map((label) => ({
    label,
    attempts: exams.reduce((sum, exam) => {
      const bucket = exam.scoreDistribution.find((item) => item.label === label);
      return sum + (bucket?.attempts ?? 0);
    }, 0),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={merged} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 11 }} interval={0} />
          <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
          <Tooltip formatter={(value) => tooltipNumber(value, "Lượt thi")} />
          <Bar dataKey="attempts" radius={[4, 4, 0, 0]}>
            {merged.map((item, index) => (
              <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExamRow({ exam }: { exam: ExamAnalyticsItem }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{exam.title}</div>
          <div className="text-xs text-muted-foreground">
            {exam.category ? `${exam.category} · ` : ""}Điểm tối đa {formatNumber(exam.maxScore)} ·
            Đạt từ {formatNumber(exam.passScore)}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Stat label="Lượt thi" value={formatNumber(exam.totalAttempts)} />
          <Stat label="Đã chấm" value={formatNumber(exam.gradedAttempts)} />
          <Stat label="Người thi" value={formatNumber(exam.participants)} />
          <Stat
            label="Điểm TB"
            value={exam.averageScore == null ? "—" : formatNumber(exam.averageScore)}
          />
          <Stat
            label="Cao nhất"
            value={exam.highestScore == null ? "—" : formatNumber(exam.highestScore)}
          />
          <Stat
            label="Thấp nhất"
            value={exam.lowestScore == null ? "—" : formatNumber(exam.lowestScore)}
          />
          <Stat
            label="Tỉ lệ đạt"
            value={exam.passRate == null ? "—" : formatPercent(exam.passRate)}
          />
        </div>
      </div>

      <div className="mt-3 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={exam.scoreDistribution}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 10 }} interval={0} />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              width={36}
              allowDecimals={false}
            />
            <Tooltip formatter={(value) => tooltipNumber(value, "Lượt thi")} />
            <Bar dataKey="attempts" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
