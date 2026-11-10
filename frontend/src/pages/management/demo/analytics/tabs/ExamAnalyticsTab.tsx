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
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";

type Props = {
  courseId: number;
};

export function ExamAnalyticsTab({ courseId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "exam-analytics", courseId],
    queryFn: () => courseAnalyticsApi.getExamAnalytics(courseId),
  });

  if (isLoading) {
    return <AnalyticsLoading label="Loading exam results..." />;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the exam results data for this course."
      />
    );
  }

  if (!data.exams.length) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-end">
          <ExportExcelButton
            label="Export Excel"
            successMessage="Exported the exam data."
            onExport={() => courseAnalyticsApi.exportExams(courseId)}
          />
        </div>
        <AnalyticsEmptyState message="This course has no active exams linked to it yet." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end">
        <ExportExcelButton
          label="Export Excel"
          successMessage="Exported the exam data."
          onExport={() => courseAnalyticsApi.exportExams(courseId)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Exams" value={formatNumber(data.totalExams)} />
        <MetricCard
          label="Graded attempts"
          value={formatNumber(data.totalGradedAttempts)}
          hint="Attempts with a score that were submitted or expired"
        />
        <MetricCard
          label="Average score"
          value={
            data.overallAverageScorePercent == null
              ? "—"
              : formatPercent(data.overallAverageScorePercent)
          }
          hint="As a % of the maximum score"
        />
        <MetricCard
          label="Pass rate"
          value={
            data.overallPassRate == null ? "—" : formatPercent(data.overallPassRate)
          }
          hint="Meeting the pass threshold of each exam"
          tone={data.overallPassRate != null && data.overallPassRate < 50 ? "warning" : "default"}
        />
      </div>

      <AnalyticsPanel
        title="Score distribution across the course"
        description="Total graded attempts grouped by % of the maximum score (0-20, 20-40, ...)."
      >
        <OverallDistribution exams={data.exams} />
      </AnalyticsPanel>

      <AnalyticsPanel
        title="Exam details"
        description="Average score, pass rate and score distribution for each exam in the course."
      >
        <div className="space-y-3">
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
          <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }} formatter={(value) => tooltipNumber(value, "Attempts")} />
          <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="attempts" radius={[4, 4, 0, 0]}>
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
            {exam.category ? `${exam.category} · ` : ""}Max score {formatNumber(exam.maxScore)} ·
            Pass from {formatNumber(exam.passScore)}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Stat label="Attempts" value={formatNumber(exam.totalAttempts)} />
          <Stat label="Graded" value={formatNumber(exam.gradedAttempts)} />
          <Stat label="Participants" value={formatNumber(exam.participants)} />
          <Stat
            label="Avg score"
            value={exam.averageScore == null ? "—" : formatNumber(exam.averageScore)}
          />
          <Stat
            label="Highest"
            value={exam.highestScore == null ? "—" : formatNumber(exam.highestScore)}
          />
          <Stat
            label="Lowest"
            value={exam.lowestScore == null ? "—" : formatNumber(exam.lowestScore)}
          />
          <Stat
            label="Pass rate"
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
            <Tooltip shared={false} cursor={false} wrapperStyle={{ pointerEvents: "none", zIndex: 50 }} formatter={(value) => tooltipNumber(value, "Attempts")} />
            <Bar isAnimationActive={true} animationDuration={850} animationEasing="ease-out" dataKey="attempts" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
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