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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
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
import type { AtRiskLearner } from "@/types";
import { useState } from "react";

type Props = {
  courseId: number;
};

const INACTIVE_PRESETS = [7, 14, 30];

const REASON_LABEL: Record<string, string> = {
  NEVER_STARTED: "Chưa từng vào học",
  INACTIVE: "Không hoạt động",
};

export function ActivityTab({ courseId }: Props) {
  const [inactiveDays, setInactiveDays] = useState(14);
  const [limit, setLimit] = useState(50);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["course-analytics", "activity", courseId, inactiveDays, limit],
    queryFn: () => courseAnalyticsApi.getActivity(courseId, { inactiveDays, limit }),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải mức độ hoạt động...</p>;
  }

  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Không tải được dữ liệu hoạt động của học viên."
      />
    );
  }

  const pieData = [
    { name: "Hoàn thành", value: data.completedLearners, color: CHART_COLORS[1] },
    { name: "Đang hoạt động", value: data.activeLearners, color: CHART_COLORS[0] },
    { name: "Không hoạt động", value: data.inactiveLearners, color: CHART_COLORS[2] },
    { name: "Chưa bắt đầu", value: data.neverStartedLearners, color: CHART_COLORS[3] },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">
            Ngưỡng không hoạt động
          </span>
          <div className="flex gap-2">
            {INACTIVE_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setInactiveDays(days)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  inactiveDays === days
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {days} ngày
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Số học viên hiển thị</span>
          <input
            className="w-28 rounded-md border bg-background px-3 py-2 text-sm"
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(event) =>
              setLimit(Math.max(1, Math.min(500, Number(event.target.value) || 1)))
            }
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng học viên" value={formatNumber(data.totalLearners)} />
        <MetricCard
          label="Đã hoàn thành"
          value={formatNumber(data.completedLearners)}
          tone="default"
        />
        <MetricCard
          label="Đang hoạt động"
          value={formatNumber(data.activeLearners)}
          hint={`Truy cập trong ${data.inactiveThresholdDays} ngày gần nhất`}
        />
        <MetricCard
          label="Nguy cơ bỏ học"
          value={formatNumber(data.inactiveLearners + data.neverStartedLearners)}
          hint={`Không hoạt động >= ${data.inactiveThresholdDays} ngày`}
          tone={data.inactiveLearners + data.neverStartedLearners > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel
          title="Phân bố trạng thái học viên"
          description="Dựa trên tiến độ bài học và lần truy cập gần nhất."
        >
          {pieData.length ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => tooltipNumber(value, String(name))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState message="Chưa có học viên nào trong khóa học." />
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Phân bố tiến độ học tập"
          description="Số học viên theo tỉ lệ đã hoàn thành bài học."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.progressDistribution}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={40} allowDecimals={false} />
                <Tooltip formatter={(value) => tooltipNumber(value, "Học viên")} />
                <Bar dataKey="learners" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Học viên có nguy cơ bỏ học"
        description="Xếp theo mức rủi ro rồi số ngày không truy cập. Rủi ro cao = lâu không vào học kèm tiến độ thấp."
      >
        {!data.atRiskLearners.length ? (
          <AnalyticsEmptyState message="Không có học viên nào rơi vào nhóm nguy cơ. Tốt!" />
        ) : (
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học viên</TableHead>
                  <TableHead className="text-right">Tiến độ</TableHead>
                  <TableHead className="text-right">Ngày không vào học</TableHead>
                  <TableHead>Lần truy cập gần nhất</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Mức rủi ro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.atRiskLearners.map((learner) => (
                  <AtRiskRow key={learner.enrollmentId} learner={learner} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AnalyticsPanel>
    </div>
  );
}

function AtRiskRow({ learner }: { learner: AtRiskLearner }) {
  const badgeVariant =
    learner.riskLevel === "HIGH"
      ? "destructive"
      : learner.riskLevel === "MEDIUM"
        ? "secondary"
        : "outline";

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{learner.studentName}</div>
        <div className="text-xs text-muted-foreground">{learner.studentEmail}</div>
      </TableCell>
      <TableCell className="text-right">{formatPercent(learner.progressPercentage, 0)}</TableCell>
      <TableCell className="text-right font-medium">{learner.inactiveDays} ngày</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDateTime(learner.lastAccessedAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {REASON_LABEL[learner.reason] ?? learner.reason}
      </TableCell>
      <TableCell>
        <Badge variant={badgeVariant}>{learner.riskLevel}</Badge>
      </TableCell>
    </TableRow>
  );
}
